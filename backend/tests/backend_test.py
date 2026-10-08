"""Backend regression tests for Max Power Bussines API.

Covers auth, RBAC, products, caja, sales, alerts, dashboard, users.
Uses pre-seeded sessions: test_session_admin, test_session_cajero, test_session_gerente, test_session_pendiente.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL",
                          "https://sales-alerts-pro.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _c(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def admin():
    return _c("test_session_admin")


@pytest.fixture(scope="session")
def cajero():
    return _c("test_session_cajero")


@pytest.fixture(scope="session")
def gerente():
    return _c("test_session_gerente")


@pytest.fixture(scope="session")
def pendiente():
    return _c("test_session_pendiente")


@pytest.fixture(scope="session")
def anon():
    return _c()


# ---------- Auth ----------
class TestAuth:
    def test_me_no_auth(self, anon):
        r = anon.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_bearer_admin(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "admin"
        assert "permissions" in d and "dashboard" in d["permissions"]

    def test_me_bearer_cajero(self, cajero):
        r = cajero.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "cajero"

    def test_me_invalid_token(self):
        r = _c("invalid_token_xyz").get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_cookie_session(self):
        s = requests.Session()
        s.cookies.set("session_token", "test_session_admin")
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# ---------- RBAC ----------
class TestRBAC:
    def test_pendiente_dashboard_forbidden(self, pendiente):
        assert pendiente.get(f"{API}/dashboard").status_code == 403

    def test_pendiente_products_forbidden(self, pendiente):
        assert pendiente.get(f"{API}/products").status_code == 403

    def test_cajero_dashboard_403(self, cajero):
        assert cajero.get(f"{API}/dashboard").status_code == 403

    def test_cajero_alerts_403(self, cajero):
        assert cajero.get(f"{API}/alerts").status_code == 403

    def test_cajero_users_403(self, cajero):
        assert cajero.get(f"{API}/users").status_code == 403

    def test_cajero_create_product_403(self, cajero):
        r = cajero.post(f"{API}/products", json={
            "barcode": "TEST_BC_0", "name": "x", "category": "Bebidas",
            "cost": 1, "price": 2, "stock": 1, "min_stock": 1})
        assert r.status_code == 403

    def test_cajero_stock_adjust_403(self, cajero, admin):
        prods = admin.get(f"{API}/products").json()
        assert prods, "no products seeded"
        pid = prods[0]["product_id"]
        r = cajero.post(f"{API}/products/{pid}/stock", json={"delta": 1, "reason": "x"})
        assert r.status_code == 403

    def test_gerente_dashboard_ok(self, gerente):
        assert gerente.get(f"{API}/dashboard").status_code == 200

    def test_gerente_alerts_ok(self, gerente):
        assert gerente.get(f"{API}/alerts").status_code == 200

    def test_gerente_users_403(self, gerente):
        assert gerente.get(f"{API}/users").status_code == 403

    def test_gerente_create_product_403(self, gerente):
        r = gerente.post(f"{API}/products", json={
            "barcode": "TEST_BC_G", "name": "x", "category": "Bebidas",
            "cost": 1, "price": 2, "stock": 1, "min_stock": 1})
        assert r.status_code == 403

    def test_gerente_stock_adjust_ok(self, gerente, admin):
        pid = admin.get(f"{API}/products").json()[0]["product_id"]
        r = gerente.post(f"{API}/products/{pid}/stock", json={"delta": 0, "reason": "noop test"})
        assert r.status_code == 200


# ---------- Products CRUD (admin) ----------
class TestProducts:
    created_id = None
    bc = "TEST_BC_9999001"

    def test_list_products(self, admin):
        r = admin.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_product(self, admin):
        r = admin.post(f"{API}/products", json={
            "barcode": self.bc, "name": "TEST_Prod", "category": "Bebidas",
            "cost": 10, "price": 20, "stock": 50, "min_stock": 5})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["barcode"] == self.bc
        TestProducts.created_id = d["product_id"]

    def test_duplicate_barcode(self, admin):
        r = admin.post(f"{API}/products", json={
            "barcode": self.bc, "name": "dup", "category": "Bebidas",
            "cost": 1, "price": 2, "stock": 1, "min_stock": 1})
        assert r.status_code == 400

    def test_update_product(self, admin):
        pid = TestProducts.created_id
        r = admin.put(f"{API}/products/{pid}", json={
            "barcode": self.bc, "name": "TEST_Prod_Upd", "category": "Bebidas",
            "cost": 10, "price": 25, "stock": 50, "min_stock": 5})
        assert r.status_code == 200
        assert r.json()["price"] == 25

    def test_adjust_stock(self, admin):
        pid = TestProducts.created_id
        r = admin.post(f"{API}/products/{pid}/stock", json={"delta": 10, "reason": "TEST"})
        assert r.status_code == 200
        assert r.json()["stock"] == 60

    def test_delete_product(self, admin):
        pid = TestProducts.created_id
        r = admin.delete(f"{API}/products/{pid}")
        assert r.status_code == 200

    def test_low_stock_filter(self, admin):
        r = admin.get(f"{API}/products", params={"low": "true"})
        assert r.status_code == 200


# ---------- Caja + Sales (cajero flow uses pre-opened caja) ----------
class TestCajaAndSales:
    def test_caja_actual_cajero_open(self, cajero):
        r = cajero.get(f"{API}/caja/actual")
        assert r.status_code == 200
        d = r.json()
        assert d is not None and d["status"] == "abierta"

    def test_create_sale_cajero(self, cajero, admin):
        prods = [p for p in admin.get(f"{API}/products").json() if p["stock"] >= 2][:1]
        assert prods
        pid = prods[0]["product_id"]
        stock_before = prods[0]["stock"]
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": pid, "quantity": 1}],
            "payment_method": "efectivo", "cash_received": 1000})
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["status"] == "completada"
        assert sale["change"] >= 0
        # Verify stock decreased
        prods_after = admin.get(f"{API}/products").json()
        after = next(p for p in prods_after if p["product_id"] == pid)
        assert after["stock"] == stock_before - 1
        TestCajaAndSales.sale_id = sale["sale_id"]

    def test_sale_insufficient_cash(self, cajero, admin):
        pid = next(p["product_id"] for p in admin.get(f"{API}/products").json() if p["stock"] >= 1)
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": pid, "quantity": 1}],
            "payment_method": "efectivo", "cash_received": 0.01})
        assert r.status_code == 400

    def test_sale_exceeds_stock(self, cajero, admin):
        pid = admin.get(f"{API}/products").json()[0]["product_id"]
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": pid, "quantity": 999999}],
            "payment_method": "tarjeta"})
        assert r.status_code == 400

    def test_cajero_cannot_anular(self, cajero):
        sid = getattr(TestCajaAndSales, "sale_id", None)
        if not sid:
            pytest.skip("no sale created")
        r = cajero.post(f"{API}/sales/{sid}/anular", json={"reason": "x"})
        assert r.status_code == 403

    def test_admin_anular_restores_stock(self, admin):
        sid = getattr(TestCajaAndSales, "sale_id", None)
        if not sid:
            pytest.skip("no sale created")
        sale = next(s for s in admin.get(f"{API}/sales").json() if s["sale_id"] == sid)
        pid = sale["items"][0]["product_id"]
        qty = sale["items"][0]["quantity"]
        before = next(p for p in admin.get(f"{API}/products").json() if p["product_id"] == pid)["stock"]
        r = admin.post(f"{API}/sales/{sid}/anular", json={"reason": "TEST anular"})
        assert r.status_code == 200
        assert r.json()["status"] == "anulada"
        after = next(p for p in admin.get(f"{API}/products").json() if p["product_id"] == pid)["stock"]
        assert after == before + qty

    def test_sales_filter_cajero_sees_own(self, cajero):
        r = cajero.get(f"{API}/sales", params={"days": 30})
        assert r.status_code == 200
        for s in r.json():
            assert s["cashier_id"] == "test-cajero-1"

    def test_caja_movimiento_retiro(self, cajero):
        r = cajero.post(f"{API}/caja/movimiento",
                        json={"type": "retiro", "amount": 1, "reason": "TEST retiro"})
        assert r.status_code == 200
        assert r.json()["egresos"] >= 1


# ---------- Alerts ----------
class TestAlerts:
    def test_list_alerts_admin(self, admin):
        r = admin.get(f"{API}/alerts")
        assert r.status_code == 200
        d = r.json()
        assert "stock" in d and "caja" in d

    def test_alerts_count(self, admin):
        r = admin.get(f"{API}/alerts/count")
        assert r.status_code == 200
        assert isinstance(r.json()["count"], int)


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_admin(self, admin):
        r = admin.get(f"{API}/dashboard", params={"days": 14})
        assert r.status_code == 200
        d = r.json()
        for k in ["kpis", "daily", "hourly", "payments", "categories", "top_products", "recent_sales"]:
            assert k in d
        assert len(d["daily"]) == 14

    def test_dashboard_range_7(self, admin):
        r = admin.get(f"{API}/dashboard", params={"days": 7})
        assert r.status_code == 200
        assert len(r.json()["daily"]) == 7


# ---------- Users ----------
class TestUsers:
    created = None

    def test_list_users_admin(self, admin):
        r = admin.get(f"{API}/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_user(self, admin):
        r = admin.post(f"{API}/users", json={
            "email": "test.user.created@example.com", "name": "TEST Created", "role": "cajero"})
        assert r.status_code == 200
        TestUsers.created = r.json()["user_id"]

    def test_update_role(self, admin):
        uid = TestUsers.created
        r = admin.put(f"{API}/users/{uid}", json={"role": "gerente"})
        assert r.status_code == 200
        assert r.json()["role"] == "gerente"

    def test_toggle_active(self, admin):
        uid = TestUsers.created
        r = admin.put(f"{API}/users/{uid}", json={"active": False})
        assert r.status_code == 200
        assert r.json()["active"] is False

    def test_cleanup_user(self):
        import pymongo
        c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        c["test_database"].users.delete_one({"email": "test.user.created@example.com"})



# ---------- Promociones ----------
class TestPromotions:
    created_id = None

    def test_list_promos_admin(self, admin):
        r = admin.get(f"{API}/promotions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # seeded promos should include labels
        if data:
            assert "label" in data[0] and "live" in data[0]

    def test_cajero_promos_list_forbidden(self, cajero):
        # cajero does not have "promociones" permission
        assert cajero.get(f"{API}/promotions").status_code == 403

    def test_activas_requires_pos(self, cajero):
        r = cajero.get(f"{API}/promotions/activas")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        if d:
            # all should be currently live (active+date-in-range on server)
            for p in d:
                assert p["active"] is True

    def test_create_promo_bad_dates(self, admin):
        pid = admin.get(f"{API}/products").json()[0]["product_id"]
        r = admin.post(f"{API}/promotions", json={
            "product_id": pid, "type": "descuento", "percent": 10,
            "start_date": "2026-12-31", "end_date": "2026-01-01", "active": True})
        assert r.status_code == 400

    def test_create_promo_descuento_zero_pct(self, admin):
        pid = admin.get(f"{API}/products").json()[0]["product_id"]
        r = admin.post(f"{API}/promotions", json={
            "product_id": pid, "type": "descuento", "percent": 0,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True})
        assert r.status_code == 400

    def test_create_promo_unknown_product(self, admin):
        r = admin.post(f"{API}/promotions", json={
            "product_id": "prd_doesnotexist", "type": "descuento", "percent": 10,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True})
        assert r.status_code == 404

    def test_create_update_delete_promo(self, admin):
        # pick a product that doesn't already have a seeded promo
        promos = admin.get(f"{API}/promotions").json()
        used = {p["product_id"] for p in promos}
        prods = admin.get(f"{API}/products").json()
        pid = next(p["product_id"] for p in prods if p["product_id"] not in used)
        r = admin.post(f"{API}/promotions", json={
            "product_id": pid, "type": "descuento", "percent": 25,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["label"] == "-25%"
        TestPromotions.created_id = d["promo_id"]
        # verify in list
        rows = admin.get(f"{API}/promotions").json()
        assert any(p["promo_id"] == d["promo_id"] for p in rows)
        # update to 2x1
        r = admin.put(f"{API}/promotions/{d['promo_id']}", json={
            "product_id": pid, "type": "2x1", "percent": 0,
            "start_date": "2026-01-01", "end_date": "2026-12-31", "active": True})
        assert r.status_code == 200
        assert r.json()["label"] == "2x1"
        # delete
        r = admin.delete(f"{API}/promotions/{d['promo_id']}")
        assert r.status_code == 200

    def test_sale_applies_2x1(self, cajero, admin):
        # Refresco Cola 2L should have 2x1 live promo
        prods = admin.get(f"{API}/products").json()
        cola = next((p for p in prods if p["name"] == "Refresco Cola 2L"), None)
        assert cola, "seeded product Refresco Cola 2L missing"
        price = cola["price"]
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": cola["product_id"], "quantity": 2}],
            "payment_method": "tarjeta"})
        assert r.status_code == 200, r.text
        sale = r.json()
        # 2x1 on qty=2 -> discount = price * floor(2/2) = price
        assert abs(sale["discount_total"] - round(price, 2)) < 0.01
        item = sale["items"][0]
        assert item.get("promo") and item["promo"]["label"] == "2x1"
        # subtotal = gross; tax on (subtotal-discount); total
        subtotal = round(price * 2, 2)
        taxable = round(subtotal - sale["discount_total"], 2)
        expected_tax = round(taxable * 0.16, 2)
        assert abs(sale["subtotal"] - subtotal) < 0.01
        assert abs(sale["tax"] - expected_tax) < 0.01
        assert abs(sale["total"] - round(taxable + expected_tax, 2)) < 0.01

    def test_sale_applies_descuento(self, cajero, admin):
        prods = admin.get(f"{API}/products").json()
        gal = next((p for p in prods if p["name"] == "Galletas Surtidas 500g"), None)
        assert gal
        price = gal["price"]
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": gal["product_id"], "quantity": 1}],
            "payment_method": "tarjeta"})
        assert r.status_code == 200, r.text
        sale = r.json()
        expected_disc = round(price * 15 / 100, 2)
        assert abs(sale["discount_total"] - expected_disc) < 0.01
        assert sale["items"][0]["promo"]["label"] == "-15%"


# ---------- Kg products ----------
class TestKgProducts:
    def test_pieza_rejects_fractional(self, cajero, admin):
        pid = next(p["product_id"] for p in admin.get(f"{API}/products").json()
                   if p.get("unit", "pieza") == "pieza" and p["stock"] >= 2)
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": pid, "quantity": 1.25}],
            "payment_method": "tarjeta"})
        assert r.status_code == 400
        assert "pieza" in r.text.lower()

    def test_kg_accepts_fractional(self, cajero, admin):
        kg_prod = next((p for p in admin.get(f"{API}/products").json()
                        if p.get("unit") == "kg" and p["stock"] >= 2), None)
        assert kg_prod, "no kg product seeded"
        r = cajero.post(f"{API}/sales", json={
            "items": [{"product_id": kg_prod["product_id"], "quantity": 1.25}],
            "payment_method": "tarjeta"})
        assert r.status_code == 200, r.text
        assert r.json()["items"][0]["quantity"] == 1.25

    def test_kg_stock_delta_float(self, admin):
        kg_prod = next(p for p in admin.get(f"{API}/products").json() if p.get("unit") == "kg")
        r = admin.post(f"{API}/products/{kg_prod['product_id']}/stock",
                       json={"delta": 0.5, "reason": "TEST float stock"})
        assert r.status_code == 200
        # Compensate
        admin.post(f"{API}/products/{kg_prod['product_id']}/stock",
                   json={"delta": -0.5, "reason": "TEST undo"})


# ---------- Reports ----------
class TestReports:
    def test_monthly_pdf_admin(self, admin):
        r = admin.get(f"{API}/reports/monthly", params={"year": 2026, "month": 10})
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 10_000
        assert r.content[:4] == b"%PDF"

    def test_monthly_pdf_empty_month(self, admin):
        r = admin.get(f"{API}/reports/monthly", params={"year": 2026, "month": 6})
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_monthly_invalid_month(self, admin):
        r = admin.get(f"{API}/reports/monthly", params={"year": 2026, "month": 13})
        assert r.status_code == 400

    def test_monthly_gerente_forbidden(self, gerente):
        r = gerente.get(f"{API}/reports/monthly", params={"year": 2026, "month": 10})
        assert r.status_code == 403

    def test_monthly_cajero_forbidden(self, cajero):
        r = cajero.get(f"{API}/reports/monthly", params={"year": 2026, "month": 10})
        assert r.status_code == 403
