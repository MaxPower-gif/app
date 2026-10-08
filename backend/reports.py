import io
from collections import defaultdict
from datetime import datetime, date, timedelta

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre",
         "Noviembre", "Diciembre"]
PAY = {"efectivo": "Efectivo", "tarjeta": "Tarjeta", "transferencia": "Transferencia"}
ACCENT = "#E8590C"
INK = "#1A1A1A"


def money(n):
    return f"-${abs(n):,.2f}" if n < 0 else f"${n:,.2f}"


def _chart(fig):
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=160)
    plt.close(fig)
    buf.seek(0)
    return buf


def _daily_chart(daily):
    fig, ax = plt.subplots(figsize=(7.2, 2.6))
    xs = [d.day for d in daily]
    ax.bar(xs, [v["ingresos"] for v in daily.values()], color=ACCENT, width=0.7)
    ax.set_title("Ingresos por día", loc="left", fontsize=10, fontweight="bold", color=INK)
    ax.set_xticks(xs[::2])
    ax.tick_params(labelsize=7)
    ax.spines[["top", "right"]].set_visible(False)
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    return _chart(fig)


def _cat_pay_chart(cats, pays):
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.2, 2.8))
    items = sorted(cats.items(), key=lambda x: x[1])
    a1.barh([k for k, _ in items], [v for _, v in items], color=ACCENT)
    a1.set_title("Ventas por categoría", loc="left", fontsize=10, fontweight="bold", color=INK)
    a1.tick_params(labelsize=7)
    a1.spines[["top", "right"]].set_visible(False)
    a1.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"${v:,.0f}"))
    if pays:
        a2.pie(list(pays.values()), labels=[PAY.get(k, k) for k in pays], autopct="%1.0f%%",
               colors=[ACCENT, "#2B8A3E", "#1C7ED6"], textprops={"fontsize": 7})
    a2.set_title("Método de pago", loc="left", fontsize=10, fontweight="bold", color=INK)
    return _chart(fig)


def _table(data, widths, header=True):
    t = Table(data, colWidths=widths)
    style = [("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#DDDDDD")),
             ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(INK)), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                  ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold")]
    t.setStyle(TableStyle(style))
    return t


def build_monthly_report(sales, cash_sessions, year, month, generated_by):
    start = date(year, month, 1)
    end = date(year + (month == 12), (month % 12) + 1, 1)
    daily = {start + timedelta(days=i): {"ingresos": 0.0, "ventas": 0} for i in range((end - start).days)}
    cats, pays, prods = defaultdict(float), defaultdict(float), defaultdict(lambda: {"qty": 0.0, "total": 0.0})
    total = discounts = tax = 0.0
    promo_count = 0
    for s in sales:
        d = datetime.fromisoformat(s["created_at"]).date()
        if d in daily:
            daily[d]["ingresos"] += s["total"]
            daily[d]["ventas"] += 1
        total += s["total"]
        tax += s["tax"]
        discounts += s.get("discount_total", 0)
        pays[s["payment_method"]] += s["total"]
        for it in s["items"]:
            cats[it["category"]] += it["line_total"]
            prods[it["name"]]["qty"] += it["quantity"]
            prods[it["name"]]["total"] += it["line_total"]
            if it.get("promo"):
                promo_count += 1
    n = len(sales)
    best_day = max(daily.items(), key=lambda x: x[1]["ingresos"]) if n else None

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=22, textColor=colors.HexColor(INK), alignment=0, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#666666"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, textColor=colors.HexColor(ACCENT), spaceBefore=10, spaceAfter=4)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=1.6 * cm, rightMargin=1.6 * cm, topMargin=1.4 * cm, bottomMargin=1.4 * cm,
                            title=f"Reporte de ingresos {MESES[month - 1]} {year}")
    el = [Paragraph("MAX POWER BUSSINES", h1),
          Paragraph(f"Reporte de ingresos · {MESES[month - 1]} {year} · Generado por {generated_by} el "
                    f"{datetime.now().strftime('%d/%m/%Y %H:%M')}", sub), Spacer(1, 10)]

    kpis = [["Ingresos del mes", "Tickets", "Ticket promedio", "IVA cobrado", "Descuentos otorgados"],
            [money(total), str(n), money(total / n if n else 0), money(tax), money(discounts)]]
    kt = Table(kpis, colWidths=[3.6 * cm] * 5)
    kt.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, 0), 7), ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#666666")),
                            ("FONTSIZE", (0, 1), (-1, 1), 13), ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                            ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor(INK)),
                            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
                            ("LINEAFTER", (0, 0), (-2, -1), 0.5, colors.HexColor("#DDDDDD")),
                            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    el += [kt, Spacer(1, 8)]
    if best_day:
        el.append(Paragraph(f"Mejor día: <b>{best_day[0].strftime('%d/%m/%Y')}</b> con {money(best_day[1]['ingresos'])} "
                            f"en {best_day[1]['ventas']} tickets · Artículos con promoción aplicada: <b>{promo_count}</b>", sub))
    el += [Spacer(1, 6), Image(_daily_chart(daily), width=17.5 * cm, height=6.3 * cm),
           Image(_cat_pay_chart(cats, pays), width=17.5 * cm, height=6.8 * cm)]

    el.append(Paragraph("Top 10 productos", h2))
    top = sorted(prods.items(), key=lambda x: -x[1]["total"])[:10]
    el.append(_table([["Producto", "Cantidad", "Ingresos"]] + [[k, f"{v['qty']:g}", money(v["total"])] for k, v in top],
                     [10.5 * cm, 3.5 * cm, 3.5 * cm]))

    el.append(Paragraph("Ventas por categoría", h2))
    el.append(_table([["Categoría", "Ingresos", "% del total"]] +
                     [[k, money(v), f"{(v / total * 100 if total else 0):.1f}%"] for k, v in sorted(cats.items(), key=lambda x: -x[1])],
                     [10.5 * cm, 3.5 * cm, 3.5 * cm]))

    el.append(Paragraph("Resumen de cajas cerradas", h2))
    rows = [["Fecha", "Cajero", "Esperado", "Contado", "Diferencia"]]
    for c in cash_sessions:
        rows.append([datetime.fromisoformat(c["opened_at"]).strftime("%d/%m/%Y"), c["user_name"], money(c.get("expected_amount", 0)),
                     money(c.get("counted_amount", 0)), money(c.get("difference", 0))])
    if len(rows) == 1:
        rows.append(["Sin cierres en el mes", "", "", "", ""])
    el.append(_table(rows, [3.2 * cm, 5.3 * cm, 3 * cm, 3 * cm, 3 * cm]))
    el[-1].setStyle(TableStyle([("ALIGN", (1, 1), (1, -1), "LEFT")]))

    el.append(Paragraph("Detalle diario", h2))
    rows = [["Día", "Tickets", "Ingresos"]] + [[d.strftime("%d/%m"), str(v["ventas"]), money(v["ingresos"])] for d, v in daily.items()]
    el.append(_table(rows, [5.5 * cm, 6 * cm, 6 * cm]))
    doc.build(el)
    buf.seek(0)
    return buf.getvalue()
