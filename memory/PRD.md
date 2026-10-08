# Max Power Bussines - PRD

## Original problem statement
"Creame una pagina web , que se llame Max Power Bussines ,de empresa de negocios profesional , dando conocimiento de Ingresos ventas alertas caja supermercado. Hazlo a profundidad con todo los permisos habilitados"

User choices: management dashboard with real saved data; roles Administrador/Gerente/Cajero; Google login; POS with products, inventory, cash open/close, low stock alerts; seeded sample data.

## Architecture
- FastAPI (server.py, seed.py) + MongoDB + React (CRA, shadcn, recharts)
- Emergent-managed Google Auth, httpOnly cookie session (7 days)
- RBAC via ROLE_PERMS in server.py; ADMIN_EMAIL always admin; new users "pendiente"
- Env: ADMIN_EMAIL, TAX_RATE (0.16), CASH_LIMIT (5000)

## Personas
Administrador (owner), Gerente (store manager), Cajero (cashier)

## Core requirements
Dashboard KPIs/charts, POS, Caja (apertura, movimientos, cierre/arqueo), Inventario CRUD + stock, Ventas history + anular, Alertas (stock bajo, diferencia caja, límite efectivo), Usuarios y roles

## Implemented (2026-10-07)
- All modules above, Spanish UI, dark/light theme, mobile responsive
- Seed: 40 products, ~900 sales over 30 days, 5 closed cash sessions
- Tested: backend 41/41, frontend flows 100% (iteration_1)

## Implemented (2026-10-08) — Promociones, Reporte PDF, Báscula
- Promociones (admin/gerente, perm `promociones`): descuento % por producto y 2x1 con vigencia (start/end) y activo; CRUD /api/promotions; /api/promotions/activas para POS
- POS aplica promos solo al cobrar (backend `price_line`): 2x1 = price*floor(qty/2); descuento = gross*%; venta guarda discount_total, items.discount/promo; IVA sobre neto. Ticket, carrito y detalle de venta muestran descuentos
- Reporte PDF mensual (solo admin, perm `reportes`): GET /api/reports/monthly?year&month (reportlab+matplotlib): KPIs, ingresos/día, categorías, método de pago, top 10, cajas cerradas, detalle diario. Botón en Dashboard (ReportButton.jsx)
- Productos por peso: campo `unit` (pieza|kg), stock/cantidad float; calculadora "Báscula" en POS (mg/g/kg/t/oz/lb) agrega kg fraccionales; piezas rechazan fracciones
- Seed: 4 promos vigentes, 4 frutas/verduras como kg
- Tested: backend 58/58, frontend flows 100% (iteration_2)

## Backlog
- P1: Multi-sucursal, exportar Excel, recibos imprimibles con formato térmico
- P2: Proveedores y órdenes de compra, lector de código de barras por cámara, promos por categoría / combos, envío del reporte PDF por email mensual

## Next tasks
- User reviews first version
