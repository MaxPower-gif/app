import random
import uuid
from datetime import datetime, timezone, timedelta

PRODUCTS = [
    ("Abarrotes", "Arroz Blanco 1kg", 0.9, 1.45), ("Abarrotes", "Frijol Negro 1kg", 1.1, 1.8),
    ("Abarrotes", "Azúcar Refinada 1kg", 0.8, 1.25), ("Abarrotes", "Aceite Vegetal 1L", 1.9, 2.95),
    ("Abarrotes", "Pasta Spaghetti 500g", 0.55, 0.95), ("Abarrotes", "Harina de Trigo 1kg", 0.7, 1.15),
    ("Abarrotes", "Café Molido 250g", 2.8, 4.5), ("Abarrotes", "Sal de Mesa 1kg", 0.3, 0.6),
    ("Lácteos", "Leche Entera 1L", 0.85, 1.35), ("Lácteos", "Yogur Natural 1L", 1.4, 2.2),
    ("Lácteos", "Queso Fresco 400g", 2.6, 3.9), ("Lácteos", "Mantequilla 200g", 1.5, 2.4),
    ("Lácteos", "Huevos 12 pzas", 1.8, 2.75), ("Lácteos", "Crema Ácida 500ml", 1.2, 1.9),
    ("Bebidas", "Agua Natural 1.5L", 0.35, 0.8), ("Bebidas", "Refresco Cola 2L", 1.1, 1.95),
    ("Bebidas", "Jugo de Naranja 1L", 1.3, 2.1), ("Bebidas", "Bebida Isotónica 600ml", 0.75, 1.4),
    ("Bebidas", "Cerveza Lata 355ml", 0.8, 1.5), ("Bebidas", "Té Helado 1L", 0.9, 1.6),
    ("Enlatados", "Atún en Agua 140g", 0.85, 1.4), ("Enlatados", "Maíz Dulce 400g", 0.6, 1.05),
    ("Enlatados", "Sardinas en Tomate 425g", 1.0, 1.7), ("Enlatados", "Duraznos en Almíbar 820g", 1.6, 2.6),
    ("Enlatados", "Chiles Jalapeños 380g", 0.7, 1.2), ("Enlatados", "Sopa de Tomate 300g", 0.65, 1.1),
    ("Limpieza", "Detergente en Polvo 1kg", 1.7, 2.8), ("Limpieza", "Cloro 1L", 0.5, 0.95),
    ("Limpieza", "Lavatrastes Líquido 750ml", 1.1, 1.85), ("Limpieza", "Papel Higiénico 4 rollos", 1.4, 2.3),
    ("Limpieza", "Suavizante de Telas 1L", 1.3, 2.15), ("Limpieza", "Esponjas Multiuso 3 pzas", 0.6, 1.1),
    ("Frutas y Verduras", "Plátano 1kg", 0.4, 0.85), ("Frutas y Verduras", "Tomate 1kg", 0.7, 1.3),
    ("Frutas y Verduras", "Manzana Roja 1kg", 1.2, 2.1), ("Frutas y Verduras", "Papa 1kg", 0.5, 0.95),
    ("Panadería", "Pan de Caja Blanco", 1.3, 2.2), ("Panadería", "Tortillas de Maíz 1kg", 0.6, 1.1),
    ("Panadería", "Galletas Surtidas 500g", 1.5, 2.5), ("Panadería", "Pan Dulce Pieza", 0.25, 0.55),
]
LOW_STOCK_IDX = {3, 9, 16, 26, 36}
CATEGORIES = sorted({p[0] for p in PRODUCTS})


def _id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


WEIGHT_PRODUCTS = {"Plátano 1kg", "Tomate 1kg", "Manzana Roja 1kg", "Papa 1kg"}


async def seed_promotions(db):
    if await db.promotions.count_documents({}) > 0:
        return
    await db.products.update_many({"name": {"$in": list(WEIGHT_PRODUCTS)}}, {"$set": {"unit": "kg"}})
    await db.products.update_many({"unit": {"$exists": False}}, {"$set": {"unit": "pieza"}})
    now = datetime.now(timezone.utc).date()
    specs = [("Refresco Cola 2L", "2x1", 0), ("Galletas Surtidas 500g", "descuento", 15),
             ("Detergente en Polvo 1kg", "descuento", 20), ("Pan Dulce Pieza", "2x1", 0)]
    for name, kind, pct in specs:
        p = await db.products.find_one({"name": name}, {"_id": 0})
        if not p:
            continue
        await db.promotions.insert_one({
            "promo_id": _id("prm"), "product_id": p["product_id"], "product_name": p["name"], "price": p["price"],
            "type": kind, "percent": pct, "start_date": (now - timedelta(days=3)).isoformat(),
            "end_date": (now + timedelta(days=14)).isoformat(), "active": True,
            "created_by": "Sistema", "created_at": datetime.now(timezone.utc).isoformat(),
        })


async def seed_database(db, tax_rate: float):
    if await db.products.count_documents({}) > 0:
        return
    random.seed(42)
    now = datetime.now(timezone.utc)
    products = []
    for i, (cat, name, cost, price) in enumerate(PRODUCTS):
        stock = random.randint(2, 6) if i in LOW_STOCK_IDX else random.randint(35, 180)
        products.append({
            "product_id": _id("prd"), "barcode": f"750{1000000 + i * 7919:07d}"[:13],
            "name": name, "category": cat, "cost": cost, "price": price,
            "stock": stock, "min_stock": 10, "created_at": now.isoformat(),
        })
    await db.products.insert_many([dict(p) for p in products])

    weights = [0.55, 0.35, 0.10]
    methods = ["efectivo", "tarjeta", "transferencia"]
    sales = []
    for d in range(30, -1, -1):
        day = now - timedelta(days=d)
        n = random.randint(18, 38) if d else random.randint(10, 18)
        for _ in range(n):
            hour = random.choices(range(8, 22), weights=[2, 3, 4, 5, 6, 5, 4, 4, 5, 7, 8, 7, 5, 3])[0]
            ts = day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            if ts > now:
                ts = now - timedelta(minutes=random.randint(1, 300))
            items = []
            for p in random.sample(products, random.randint(1, 6)):
                q = random.randint(1, 4)
                items.append({"product_id": p["product_id"], "name": p["name"], "category": p["category"],
                              "price": p["price"], "quantity": q, "line_total": round(p["price"] * q, 2)})
            subtotal = round(sum(i["line_total"] for i in items), 2)
            tax = round(subtotal * tax_rate, 2)
            total = round(subtotal + tax, 2)
            method = random.choices(methods, weights=weights)[0]
            received = round(total + random.choice([0, 0.5, 1, 5, 10]), 2) if method == "efectivo" else total
            sales.append({
                "sale_id": _id("vta"), "folio": f"T-{len(sales) + 1:06d}", "items": items,
                "subtotal": subtotal, "tax": tax, "total": total, "payment_method": method,
                "cash_received": received, "change": round(received - total, 2),
                "cashier_id": "seed", "cashier_name": "Cajero Demo", "caja_id": None,
                "status": "anulada" if random.random() < 0.02 else "completada",
                "created_at": ts.isoformat(),
            })
    await db.sales.insert_many(sales)
    await db.counters.update_one({"_id": "folio"}, {"$set": {"seq": len(sales)}}, upsert=True)

    for d in range(5, 0, -1):
        opened = (now - timedelta(days=d)).replace(hour=8, minute=0, second=0)
        expected = round(random.uniform(1800, 3200), 2)
        diff = -12.5 if d == 2 else 0.0
        caja_id = _id("caj")
        await db.cash_sessions.insert_one({
            "caja_id": caja_id, "user_id": "seed", "user_name": "Cajero Demo",
            "opening_amount": 500.0, "opened_at": opened.isoformat(),
            "closed_at": (opened + timedelta(hours=13)).isoformat(), "status": "cerrada",
            "expected_amount": expected, "counted_amount": round(expected + diff, 2),
            "difference": diff, "notes": "", "closing_notes": "",
        })
        if diff:
            await db.alerts.insert_one({
                "alert_id": _id("alr"), "type": "caja_diferencia", "severity": "alta",
                "title": "Diferencia en cierre de caja",
                "message": f"Cierre de Cajero Demo con faltante de ${abs(diff):.2f}",
                "ref_id": caja_id, "resolved": False, "created_at": (opened + timedelta(hours=13)).isoformat(),
            })
