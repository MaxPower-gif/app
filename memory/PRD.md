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

## Backlog
- P1: Multi-sucursal, reportes PDF/Excel, recibos imprimibles con formato térmico
- P2: Descuentos/promociones, proveedores y órdenes de compra, lector de código de barras por cámara

## Next tasks
- User reviews first version
