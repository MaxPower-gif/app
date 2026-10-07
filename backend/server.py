from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from seed import seed_database, CATEGORIES

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
ADMIN_EMAIL = os.environ['ADMIN_EMAIL'].lower()
TAX_RATE = float(os.environ['TAX_RATE'])
CASH_LIMIT = float(os.environ['CASH_LIMIT'])

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

ROLE_PERMS = {
    "admin": ["dashboard", "ventas", "ventas_todas", "anular", "alertas", "pos", "caja", "caja_todas",
              "productos", "productos_editar", "stock", "usuarios"],
    "gerente": ["dashboard", "ventas", "ventas_todas", "anular", "alertas", "pos", "caja", "caja_todas",
                "productos", "stock"],
    "cajero": ["ventas", "pos", "caja", "productos"],
    "pendiente": [],
}
Role = Literal["admin", "gerente", "cajero", "pendiente"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def public_user(u):
    return {**u, "permissions": ROLE_PERMS[u["role"]] if u.get("active", True) else []}


# ---------- Auth ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "No autenticado")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Sesión inválida")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Sesión expirada")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user


def require(perm: str):
    async def dep(user: dict = Depends(get_current_user)):
        if not user.get("active", True) or perm not in ROLE_PERMS[user["role"]]:
            raise HTTPException(403, "No tienes permiso para esta acción")
        return user
    return dep


def has(user, perm):
    return perm in ROLE_PERMS[user["role"]]


class SessionIn(BaseModel):
    session_id: str


@api.post("/auth/session")
async def create_session(body: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                         headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "No se pudo validar la sesión de Google")
    data = r.json()
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    update = {"name": existing.get("name") or data["name"] if existing else data["name"],
              "picture": data.get("picture", ""), "last_login": now_iso()}
    if email == ADMIN_EMAIL:
        update.update({"role": "admin", "active": True})
    if existing:
        await db.users.update_one({"email": email}, {"$set": update})
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "role": "pendiente", "active": True,
                                   "created_at": now_iso(), **update})
    token = data["session_token"]
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": token,
                                       "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                                       "created_at": datetime.now(timezone.utc)})
    response.set_cookie("session_token", token, httponly=True, secure=True, samesite="none",
                        path="/", max_age=7 * 24 * 3600)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return public_user(user)


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


# ---------- Users ----------
class UserCreate(BaseModel):
    email: str
    name: str
    role: Role


class UserUpdate(BaseModel):
    role: Optional[Role] = None
    active: Optional[bool] = None
    name: Optional[str] = None


@api.get("/users")
async def list_users(_: dict = Depends(require("usuarios"))):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [public_user(u) for u in users]


@api.post("/users")
async def create_user(body: UserCreate, _: dict = Depends(require("usuarios"))):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Email inválido")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Ya existe un usuario con ese email")
    doc = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": body.name.strip(),
           "picture": "", "role": body.role, "active": True, "created_at": now_iso(), "last_login": None}
    await db.users.insert_one(dict(doc))
    return public_user(doc)


@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, me_: dict = Depends(require("usuarios"))):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    changes = body.model_dump(exclude_none=True)
    if (target["user_id"] == me_["user_id"] or target["email"] == ADMIN_EMAIL) and \
            (changes.get("role", "admin") != "admin" or changes.get("active", True) is False):
        raise HTTPException(400, "No puedes quitar permisos de administrador a esta cuenta")
    await db.users.update_one({"user_id": user_id}, {"$set": changes})
    return public_user(await db.users.find_one({"user_id": user_id}, {"_id": 0}))


@api.get("/roles")
async def roles(_: dict = Depends(get_current_user)):
    return ROLE_PERMS


# ---------- Products ----------
class ProductIn(BaseModel):
    barcode: str
    name: str
    category: str
    cost: float = Field(ge=0)
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    min_stock: int = Field(ge=0)


class StockIn(BaseModel):
    delta: int
    reason: str


@api.get("/categories")
async def categories(_: dict = Depends(get_current_user)):
    return CATEGORIES


@api.get("/products")
async def list_products(search: str = "", category: str = "", low: bool = False,
                        _: dict = Depends(require("productos"))):
    q = {}
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"barcode": {"$regex": search}}]
    if category:
        q["category"] = category
    if low:
        q["$expr"] = {"$lte": ["$stock", "$min_stock"]}
    return await db.products.find(q, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/products")
async def create_product(body: ProductIn, _: dict = Depends(require("productos_editar"))):
    if await db.products.find_one({"barcode": body.barcode}):
        raise HTTPException(400, "Ya existe un producto con ese código de barras")
    doc = {"product_id": new_id("prd"), **body.model_dump(), "created_at": now_iso()}
    await db.products.insert_one(dict(doc))
    return doc


@api.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, _: dict = Depends(require("productos_editar"))):
    dup = await db.products.find_one({"barcode": body.barcode, "product_id": {"$ne": product_id}})
    if dup:
        raise HTTPException(400, "Ya existe un producto con ese código de barras")
    doc = await db.products.find_one_and_update({"product_id": product_id}, {"$set": body.model_dump()},
                                                projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(404, "Producto no encontrado")
    return doc


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, _: dict = Depends(require("productos_editar"))):
    res = await db.products.delete_one({"product_id": product_id})
    if not res.deleted_count:
        raise HTTPException(404, "Producto no encontrado")
    return {"ok": True}


@api.post("/products/{product_id}/stock")
async def adjust_stock(product_id: str, body: StockIn, user: dict = Depends(require("stock"))):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    if p["stock"] + body.delta < 0:
        raise HTTPException(400, "El stock no puede quedar negativo")
    doc = await db.products.find_one_and_update({"product_id": product_id}, {"$inc": {"stock": body.delta}},
                                                projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    await db.stock_movements.insert_one({"movement_id": new_id("stk"), "product_id": product_id,
                                         "delta": body.delta, "reason": body.reason,
                                         "user_name": user["name"], "created_at": now_iso()})
    return doc


# ---------- Caja ----------
class CajaOpen(BaseModel):
    opening_amount: float = Field(ge=0)
    notes: str = ""


class CajaMove(BaseModel):
    type: Literal["ingreso", "retiro", "pago_proveedor"]
    amount: float = Field(gt=0)
    reason: str


class CajaClose(BaseModel):
    counted_amount: float = Field(ge=0)
    notes: str = ""


async def caja_summary(caja: dict) -> dict:
    sales = await db.sales.find({"caja_id": caja["caja_id"], "status": "completada"}, {"_id": 0}).to_list(5000)
    moves = await db.cash_movements.find({"caja_id": caja["caja_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    by_method = defaultdict(float)
    for s in sales:
        by_method[s["payment_method"]] += s["total"]
    ingresos = sum(m["amount"] for m in moves if m["type"] == "ingreso")
    egresos = sum(m["amount"] for m in moves if m["type"] != "ingreso")
    expected = caja["opening_amount"] + by_method["efectivo"] + ingresos - egresos
    return {**caja, "sales_count": len(sales), "sales_total": round(sum(by_method.values()), 2),
            "sales_efectivo": round(by_method["efectivo"], 2), "sales_tarjeta": round(by_method["tarjeta"], 2),
            "sales_transferencia": round(by_method["transferencia"], 2), "ingresos_extra": round(ingresos, 2),
            "egresos": round(egresos, 2), "expected_cash": round(expected, 2), "movements": moves}


async def open_caja_for(user):
    return await db.cash_sessions.find_one({"user_id": user["user_id"], "status": "abierta"}, {"_id": 0})


@api.get("/caja/actual")
async def caja_actual(user: dict = Depends(require("caja"))):
    caja = await open_caja_for(user)
    return await caja_summary(caja) if caja else None


@api.post("/caja/abrir")
async def caja_abrir(body: CajaOpen, user: dict = Depends(require("caja"))):
    if await open_caja_for(user):
        raise HTTPException(400, "Ya tienes una caja abierta")
    doc = {"caja_id": new_id("caj"), "user_id": user["user_id"], "user_name": user["name"],
           "opening_amount": body.opening_amount, "opened_at": now_iso(), "status": "abierta",
           "notes": body.notes, "closed_at": None}
    await db.cash_sessions.insert_one(dict(doc))
    return await caja_summary(doc)


@api.post("/caja/movimiento")
async def caja_movimiento(body: CajaMove, user: dict = Depends(require("caja"))):
    caja = await open_caja_for(user)
    if not caja:
        raise HTTPException(400, "No tienes una caja abierta")
    summary = await caja_summary(caja)
    if body.type != "ingreso" and body.amount > summary["expected_cash"]:
        raise HTTPException(400, "El monto supera el efectivo disponible en caja")
    await db.cash_movements.insert_one({"movement_id": new_id("mov"), "caja_id": caja["caja_id"],
                                        "type": body.type, "amount": body.amount, "reason": body.reason,
                                        "user_name": user["name"], "created_at": now_iso()})
    return await caja_summary(caja)


@api.post("/caja/cerrar")
async def caja_cerrar(body: CajaClose, user: dict = Depends(require("caja"))):
    caja = await open_caja_for(user)
    if not caja:
        raise HTTPException(400, "No tienes una caja abierta")
    s = await caja_summary(caja)
    diff = round(body.counted_amount - s["expected_cash"], 2)
    closed = {"status": "cerrada", "closed_at": now_iso(), "expected_amount": s["expected_cash"],
              "counted_amount": body.counted_amount, "difference": diff, "closing_notes": body.notes}
    await db.cash_sessions.update_one({"caja_id": caja["caja_id"]}, {"$set": closed})
    if abs(diff) >= 0.01:
        kind = "faltante" if diff < 0 else "sobrante"
        await db.alerts.insert_one({"alert_id": new_id("alr"), "type": "caja_diferencia", "severity": "alta",
                                    "title": "Diferencia en cierre de caja",
                                    "message": f"Cierre de {user['name']} con {kind} de ${abs(diff):.2f}",
                                    "ref_id": caja["caja_id"], "resolved": False, "created_at": now_iso()})
    return {**s, **closed}


@api.get("/caja/historial")
async def caja_historial(user: dict = Depends(require("caja"))):
    q = {} if has(user, "caja_todas") else {"user_id": user["user_id"]}
    return await db.cash_sessions.find(q, {"_id": 0}).sort("opened_at", -1).to_list(200)


# ---------- Sales ----------
class SaleItemIn(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


class SaleIn(BaseModel):
    items: List[SaleItemIn] = Field(min_length=1)
    payment_method: Literal["efectivo", "tarjeta", "transferencia"]
    cash_received: Optional[float] = None


class AnularIn(BaseModel):
    reason: str


@api.post("/sales")
async def create_sale(body: SaleIn, user: dict = Depends(require("pos"))):
    caja = await open_caja_for(user)
    if not caja:
        raise HTTPException(400, "Debes abrir caja antes de vender")
    qty = defaultdict(int)
    for it in body.items:
        qty[it.product_id] += it.quantity
    products = {p["product_id"]: p for p in
                await db.products.find({"product_id": {"$in": list(qty)}}, {"_id": 0}).to_list(500)}
    for pid, q in qty.items():
        if pid not in products:
            raise HTTPException(400, "Producto no encontrado")
        if products[pid]["stock"] < q:
            raise HTTPException(400, f"Stock insuficiente: {products[pid]['name']}")
    items = [{"product_id": pid, "name": products[pid]["name"], "category": products[pid]["category"],
              "price": products[pid]["price"], "quantity": q, "line_total": round(products[pid]["price"] * q, 2)}
             for pid, q in qty.items()]
    subtotal = round(sum(i["line_total"] for i in items), 2)
    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    received = total
    if body.payment_method == "efectivo":
        if body.cash_received is None or body.cash_received < total:
            raise HTTPException(400, "El efectivo recibido es menor al total")
        received = body.cash_received
    decremented = []
    for pid, q in qty.items():
        res = await db.products.update_one({"product_id": pid, "stock": {"$gte": q}}, {"$inc": {"stock": -q}})
        if not res.modified_count:
            for d_pid, d_q in decremented:
                await db.products.update_one({"product_id": d_pid}, {"$inc": {"stock": d_q}})
            raise HTTPException(400, f"Stock insuficiente: {products[pid]['name']}")
        decremented.append((pid, q))
    counter = await db.counters.find_one_and_update({"_id": "folio"}, {"$inc": {"seq": 1}}, upsert=True,
                                                    return_document=ReturnDocument.AFTER)
    sale = {"sale_id": new_id("vta"), "folio": f"T-{counter['seq']:06d}", "items": items, "subtotal": subtotal,
            "tax": tax, "total": total, "payment_method": body.payment_method, "cash_received": round(received, 2),
            "change": round(received - total, 2), "cashier_id": user["user_id"], "cashier_name": user["name"],
            "caja_id": caja["caja_id"], "status": "completada", "created_at": now_iso()}
    await db.sales.insert_one(dict(sale))
    summary = await caja_summary(caja)
    if summary["expected_cash"] > CASH_LIMIT and not await db.alerts.find_one(
            {"type": "caja_limite", "ref_id": caja["caja_id"], "resolved": False}):
        await db.alerts.insert_one({"alert_id": new_id("alr"), "type": "caja_limite", "severity": "media",
                                    "title": "Efectivo en caja sobre el límite",
                                    "message": f"La caja de {user['name']} supera ${CASH_LIMIT:,.2f}. Realiza un retiro.",
                                    "ref_id": caja["caja_id"], "resolved": False, "created_at": now_iso()})
    return sale


@api.get("/sales")
async def list_sales(days: int = 7, payment_method: str = "", status: str = "",
                     user: dict = Depends(require("ventas"))):
    q = {"created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()}}
    if payment_method:
        q["payment_method"] = payment_method
    if status:
        q["status"] = status
    if not has(user, "ventas_todas"):
        q["cashier_id"] = user["user_id"]
    return await db.sales.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/sales/{sale_id}/anular")
async def anular_sale(sale_id: str, body: AnularIn, user: dict = Depends(require("anular"))):
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(404, "Venta no encontrada")
    if sale["status"] == "anulada":
        raise HTTPException(400, "La venta ya está anulada")
    for it in sale["items"]:
        await db.products.update_one({"product_id": it["product_id"]}, {"$inc": {"stock": it["quantity"]}})
    upd = {"status": "anulada", "void_reason": body.reason, "voided_by": user["name"], "voided_at": now_iso()}
    await db.sales.update_one({"sale_id": sale_id}, {"$set": upd})
    return {**sale, **upd}


# ---------- Alerts ----------
async def stock_alerts():
    low = await db.products.find({"$expr": {"$lte": ["$stock", "$min_stock"]}}, {"_id": 0}).to_list(500)
    return [{"alert_id": f"stock_{p['product_id']}", "type": "stock_bajo",
             "severity": "alta" if p["stock"] == 0 else "media",
             "title": "Sin stock" if p["stock"] == 0 else "Stock bajo",
             "message": f"{p['name']}: quedan {p['stock']} unidades (mínimo {p['min_stock']})",
             "ref_id": p["product_id"], "resolved": False, "created_at": None} for p in low]


@api.get("/alerts")
async def list_alerts(_: dict = Depends(require("alertas"))):
    stored = await db.alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"stock": await stock_alerts(), "caja": stored}


@api.get("/alerts/count")
async def alerts_count(_: dict = Depends(require("alertas"))):
    low = await db.products.count_documents({"$expr": {"$lte": ["$stock", "$min_stock"]}})
    return {"count": low + await db.alerts.count_documents({"resolved": False})}


@api.post("/alerts/{alert_id}/resolver")
async def resolve_alert(alert_id: str, user: dict = Depends(require("alertas"))):
    res = await db.alerts.update_one({"alert_id": alert_id},
                                     {"$set": {"resolved": True, "resolved_by": user["name"], "resolved_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(404, "Alerta no encontrada")
    return {"ok": True}


# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(days: int = 14, tz: int = 0, _: dict = Depends(require("dashboard"))):
    days = max(1, min(days, 30))
    now = datetime.now(timezone.utc)
    offset = timedelta(minutes=tz)
    since = (now - timedelta(days=days + 1)).isoformat()
    sales = await db.sales.find({"created_at": {"$gte": since}, "status": "completada"}, {"_id": 0}).to_list(20000)
    today = (now - offset).date()
    yesterday = today - timedelta(days=1)
    start = today - timedelta(days=days - 1)
    daily = {start + timedelta(days=i): {"ingresos": 0.0, "ventas": 0} for i in range(days)}
    hourly = {h: 0.0 for h in range(24)}
    pay, cats, prods = defaultdict(float), defaultdict(float), defaultdict(lambda: {"qty": 0, "total": 0.0})
    y_total, y_count = 0.0, 0
    for s in sales:
        local = datetime.fromisoformat(s["created_at"]) - offset
        d = local.date()
        if d == yesterday:
            y_total += s["total"]
            y_count += 1
        if d == today:
            hourly[local.hour] += s["total"]
        if d in daily:
            daily[d]["ingresos"] += s["total"]
            daily[d]["ventas"] += 1
            pay[s["payment_method"]] += s["total"]
            for it in s["items"]:
                cats[it["category"]] += it["line_total"]
                prods[it["name"]]["qty"] += it["quantity"]
                prods[it["name"]]["total"] += it["line_total"]
    t = daily[today]
    products = await db.products.find({}, {"_id": 0, "stock": 1, "cost": 1, "min_stock": 1}).to_list(5000)
    pending = await db.alerts.count_documents({"resolved": False})
    low = sum(1 for p in products if p["stock"] <= p["min_stock"])
    period_total = sum(v["ingresos"] for v in daily.values())
    period_count = sum(v["ventas"] for v in daily.values())
    recent = await db.sales.find({}, {"_id": 0, "items": 0}).sort("created_at", -1).to_list(6)
    return {
        "kpis": {
            "ingresos_hoy": round(t["ingresos"], 2), "ventas_hoy": t["ventas"],
            "ticket_hoy": round(t["ingresos"] / t["ventas"], 2) if t["ventas"] else 0,
            "ingresos_ayer": round(y_total, 2), "ventas_ayer": y_count,
            "ticket_ayer": round(y_total / y_count, 2) if y_count else 0,
            "alertas_activas": low + pending, "stock_bajo": low,
            "cajas_abiertas": await db.cash_sessions.count_documents({"status": "abierta"}),
            "valor_inventario": round(sum(p["stock"] * p["cost"] for p in products), 2),
            "ingresos_periodo": round(period_total, 2), "ventas_periodo": period_count,
        },
        "daily": [{"fecha": d.isoformat(), "ingresos": round(v["ingresos"], 2), "ventas": v["ventas"]}
                  for d, v in daily.items()],
        "hourly": [{"hora": f"{h:02d}h", "ingresos": round(v, 2)} for h, v in hourly.items() if 7 <= h <= 22],
        "payments": [{"metodo": k, "total": round(v, 2)} for k, v in pay.items()],
        "categories": sorted([{"categoria": k, "total": round(v, 2)} for k, v in cats.items()],
                             key=lambda x: -x["total"]),
        "top_products": sorted([{"nombre": k, **{"qty": v["qty"], "total": round(v["total"], 2)}}
                                for k, v in prods.items()], key=lambda x: -x["total"])[:6],
        "recent_sales": recent,
    }


@api.get("/")
async def root():
    return {"message": "Max Power Bussines API"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.products.create_index("product_id", unique=True)
    await db.sales.create_index("created_at")
    await seed_database(db, TAX_RATE)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
