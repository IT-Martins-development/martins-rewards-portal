import requests
import re
import time
from datetime import datetime, timezone

INGEST_URL = "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/odoo/invoices"

# =========================================================
# CONFIG
# =========================================================

VENDOR_BATCH_SIZE = 100
STOCK_BATCH_SIZE = 200

API_SLEEP_BETWEEN_REQUESTS = 0.03
API_SLEEP_BETWEEN_BATCHES = 1.5
API_TIMEOUT = 30
API_MAX_RETRIES = 3
API_RETRY_SLEEP = 2.0

# =========================================================
# HELPERS
# =========================================================

def iso_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def iso_date_only(value):
    if not value:
        return iso_now()
    return "%sT00:00:00.000Z" % value

def safe_float(value):
    try:
        return float(value or 0.0)
    except Exception:
        return 0.0

def abs_float(value):
    try:
        return abs(float(value or 0.0))
    except Exception:
        return 0.0

def normalize_spaces(text):
    return re.sub(r"\s+", " ", (text or "")).strip()

def extract_wh_number(text):
    m = re.search(r"(WH/(?:OUT|IN)/\d+)", str(text or ""), re.IGNORECASE)
    return m.group(1).upper() if m else ""

def extract_return_origin(text):
    m = re.search(r"RETURN\s+OF\s+(WH/OUT/\d+)", str(text or ""), re.IGNORECASE)
    return m.group(1).upper() if m else ""

def send_payload(session, payload):
    last_error = None

    for attempt in range(1, API_MAX_RETRIES + 1):
        try:
            resp = session.post(INGEST_URL, json=payload, timeout=API_TIMEOUT)
            ok = 200 <= resp.status_code < 300

            try:
                body = resp.json()
            except Exception:
                body = resp.text

            if ok:
                return True, resp.status_code, body

            last_error = "HTTP %s | %s" % (resp.status_code, body)

        except Exception as e:
            last_error = str(e)

        if attempt < API_MAX_RETRIES:
            time.sleep(API_RETRY_SLEEP)

    return False, 500, last_error

# =========================================================
# PROJECT RESOLUTION
# =========================================================

def get_project_from_analytic_account(analytic_account):
    if analytic_account and analytic_account.project_ids:
        return analytic_account.project_ids[0]
    return False

def get_project_from_invoice_line(line):
    if getattr(line, "analytic_distribution", False):
        try:
            analytic_ids = list(line.analytic_distribution.keys())
            for analytic_id in analytic_ids:
                aa = env["account.analytic.account"].browse(int(analytic_id))
                project = get_project_from_analytic_account(aa)
                if project:
                    return project
        except Exception:
            pass

    if hasattr(line, "analytic_account_id") and line.analytic_account_id:
        project = get_project_from_analytic_account(line.analytic_account_id)
        if project:
            return project

    return False

def get_project_from_stock_line(line):
    if getattr(line, "project_id", False):
        return line.project_id

    if getattr(line, "account_id", False) and line.account_id.project_ids:
        return line.account_id.project_ids[0]

    return False

def get_project_from_svl(svl):
    move = getattr(svl, "stock_move_id", False)
    if not move:
        return False

    picking = getattr(move, "picking_id", False)
    if picking and getattr(picking, "project_id", False):
        return picking.project_id

    sale_line = getattr(move, "sale_line_id", False)
    if sale_line:
        if getattr(sale_line, "project_id", False):
            return sale_line.project_id
        if getattr(sale_line.order_id, "project_id", False):
            return sale_line.order_id.project_id

    analytic_line = env["account.analytic.line"].search([
        ("move_line_id", "=", move.id)
    ], limit=1)

    if analytic_line:
        line = analytic_line[0]
        project = get_project_from_stock_line(line)
        if project:
            return project

    return False

# =========================================================
# VENDOR BILLS - PAID ONLY
# =========================================================

def fetch_paid_vendor_bill_ids_after(last_id=0, limit=100):
    env.cr.execute("""
        SELECT id
        FROM account_move
        WHERE move_type = 'in_invoice'
          AND state = 'posted'
          AND payment_state = 'paid'
          AND id > %s
        ORDER BY id ASC
        LIMIT %s
    """, [last_id, limit])
    return [row[0] for row in env.cr.fetchall()]

def build_vendor_bill_payloads(inv):
    grouped = {}

    for line in inv.invoice_line_ids:
        subtotal = abs_float(line.price_subtotal)
        if subtotal <= 0:
            continue

        line_project = get_project_from_invoice_line(line)
        if not line_project:
            continue

        project_id = str(line_project.id)
        project_name = normalize_spaces(line_project.name or "")
        if not project_name:
            continue

        if project_id not in grouped:
            grouped[project_id] = {
                "projectId": project_id,
                "projectCode": project_name,
                "items": [],
                "amountTotal": 0.0,
            }

        grouped[project_id]["items"].append({
            "productId": int(line.product_id.id) if line.product_id else int(line.id),
            "title": normalize_spaces(line.name or "Vendor Bill Line"),
            "quantity": float(line.quantity or 0),
            "priceUnit": abs_float(line.price_unit),
            "subtotal": subtotal,
            "projectId": project_id,
            "projectCode": project_name,
            "sourceDocument": inv.invoice_origin or ""
        })

        grouped[project_id]["amountTotal"] += subtotal

    payloads = []

    for project_id, data in grouped.items():
        payloads.append({
            "odooId": "%s-%s" % (inv.id, project_id),
            "sourceOdooId": int(inv.id),
            "projectId": data["projectId"],
            "projectCode": data["projectCode"],
            "amountTotal": round(data["amountTotal"], 2),
            "date": iso_date_only(inv.invoice_date),
            "invoiceNumber": inv.name or ("BILL-%s" % inv.id),
            "status": "posted",
            "type": "vendor_bill",
            "sourceDocument": inv.invoice_origin or "",
            "syncDate": iso_now(),
            "updatedAt": iso_now(),
            "paymentStatus": inv.payment_state or "",
            "vendor": {
                "name": inv.partner_id.name if inv.partner_id else "Unknown",
                "odooPartnerId": int(inv.partner_id.id) if inv.partner_id else 0
            },
            "items": data["items"]
        })

    return payloads

# =========================================================
# STOCK - ONLY WH/OUT AND REAL WH/IN RETURNS
# =========================================================

def fetch_svl_ids_after(last_id=0, limit=200):
    env.cr.execute("""
        SELECT id
        FROM stock_valuation_layer
        WHERE product_id IS NOT NULL
          AND value <> 0
          AND id > %s
        ORDER BY id ASC
        LIMIT %s
    """, [last_id, limit])
    return [row[0] for row in env.cr.fetchall()]

def find_picking_name_from_svl(svl):
    move = getattr(svl, "stock_move_id", False)
    if move and getattr(move, "picking_id", False):
        return move.picking_id.name or ""
    return ""

def find_reference_from_svl(svl):
    candidates = [
        getattr(svl, "reference", ""),
        getattr(svl, "description", ""),
        find_picking_name_from_svl(svl),
    ]
    for c in candidates:
        wh = extract_wh_number(c)
        if wh:
            return wh
    return ""

def find_return_origin_from_svl(svl):
    move = getattr(svl, "stock_move_id", False)

    if move and getattr(move, "origin_returned_move_id", False):
        origin_move = move.origin_returned_move_id
        if getattr(origin_move, "picking_id", False):
            origin_name = extract_wh_number(origin_move.picking_id.name or "")
            if origin_name.startswith("WH/OUT/"):
                return origin_name

    candidates = [
        getattr(svl, "description", ""),
        getattr(svl, "reference", ""),
    ]
    for c in candidates:
        origin = extract_return_origin(c)
        if origin.startswith("WH/OUT/"):
            return origin

    return ""

def build_svl_payload(svl):
    project = get_project_from_svl(svl)
    if not project:
        return None, "sem projeto"

    project_name = normalize_spaces(project.name or "")
    if not project_name:
        return None, "projeto sem nome"

    value = safe_float(svl.value)
    if value == 0:
        return None, "valor zero"

    invoice_number = find_reference_from_svl(svl)
    if not invoice_number:
        return None, "sem referencia WH"

    if not (invoice_number.startswith("WH/OUT/") or invoice_number.startswith("WH/IN/")):
        return None, "nao e WH/OUT nem WH/IN"

    if invoice_number.startswith("WH/OUT/"):
        doc_type = "stock_valuation"
        actual_value = abs_float(value)
        vendor_name = "ESTOQUE/OUTROS"
        source_document = ""
    else:
        return_origin = find_return_origin_from_svl(svl)

        if not return_origin:
            return None, "WH/IN sem retorno real de WH/OUT"

        doc_type = "stock_return"
        actual_value = -abs_float(value)
        vendor_name = "ESTOQUE/DEVOLUCAO"
        source_document = return_origin

    product_name = "Stock Valuation"
    if getattr(svl, "product_id", False) and svl.product_id.name:
        product_name = normalize_spaces(svl.product_id.name)

    category = "Unclassified"
    if getattr(svl, "product_id", False) and svl.product_id.categ_id and svl.product_id.categ_id.display_name:
        category = normalize_spaces(svl.product_id.categ_id.display_name)

    title = "[%s] %s" % (category, product_name)

    qty = abs_float(getattr(svl, "quantity", 0.0) or 0.0)
    if qty <= 0:
        qty = 1.0

    payload = {
        "odooId": "SVL-%s" % svl.id,
        "sourceOdooId": int(svl.id),
        "projectId": str(project.id),
        "projectCode": project_name,
        "amountTotal": actual_value,
        "date": iso_date_only(getattr(svl, "create_date", False) and svl.create_date.date() or False),
        "invoiceNumber": invoice_number,
        "status": "posted",
        "type": doc_type,
        "sourceDocument": source_document,
        "syncDate": iso_now(),
        "updatedAt": iso_now(),
        "vendor": {
            "name": vendor_name,
            "odooPartnerId": 0
        },
        "items": [{
            "productId": int(svl.product_id.id) if getattr(svl, "product_id", False) else int(svl.id),
            "title": title,
            "quantity": qty,
            "priceUnit": actual_value,
            "subtotal": actual_value,
            "projectId": str(project.id),
            "projectCode": project_name,
            "sourceDocument": source_document
        }]
    }

    return payload, None

# =========================================================
# EXECUTION
# =========================================================

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

sent_vendor = 0
sent_stock = 0
sent_return = 0
errors = 0
skipped_vendor = 0
skipped_stock = 0
skipped_return = 0

print("🚀 Iniciando sincronização completa sem limite fixo")

# ---------------------------------------------------------
# 1) VENDOR BILLS PAGAS
# ---------------------------------------------------------

last_vendor_id = 0
vendor_batch_num = 0

while True:
    try:
        env.cr.rollback()
        vendor_ids = fetch_paid_vendor_bill_ids_after(last_id=last_vendor_id, limit=VENDOR_BATCH_SIZE)

        if not vendor_ids:
            break

        vendor_batch_num += 1
        vendor_bills = env["account.move"].browse(vendor_ids)

        for inv in vendor_bills:
            try:
                payloads = build_vendor_bill_payloads(inv)

                if not payloads:
                    skipped_vendor += 1
                    last_vendor_id = inv.id
                    continue

                for payload in payloads:
                    ok, status_code, body = send_payload(session, payload)
                    if ok:
                        sent_vendor += 1
                    else:
                        errors += 1
                        print("❌ Vendor Bill %s falhou | HTTP %s | %s" % (inv.id, status_code, body))

                    time.sleep(API_SLEEP_BETWEEN_REQUESTS)

                last_vendor_id = inv.id

            except Exception as e:
                errors += 1
                last_vendor_id = getattr(inv, "id", last_vendor_id)
                print("❌ Erro Vendor Bill %s: %s" % (getattr(inv, "id", "N/A"), str(e)))

        print(
            "📊 Lote Vendor %s | ultimo_id=%s | enviados=%s | ignorados=%s | erros=%s"
            % (vendor_batch_num, last_vendor_id, sent_vendor, skipped_vendor, errors)
        )

        time.sleep(API_SLEEP_BETWEEN_BATCHES)

    except Exception as e:
        errors += 1
        print("❌ Erro no lote Vendor após id %s: %s" % (last_vendor_id, str(e)))
        time.sleep(API_RETRY_SLEEP)

print("✅ Vendor Bills finalizadas | enviadas=%s | ignoradas=%s | erros=%s" % (
    sent_vendor, skipped_vendor, errors
))

# ---------------------------------------------------------
# 2) STOCK VALUATION LAYERS
# ---------------------------------------------------------

last_svl_id = 0
stock_batch_num = 0

while True:
    try:
        env.cr.rollback()
        svl_ids = fetch_svl_ids_after(last_id=last_svl_id, limit=STOCK_BATCH_SIZE)

        if not svl_ids:
            break

        stock_batch_num += 1
        svls = env["stock.valuation.layer"].browse(svl_ids)

        for svl in svls:
            try:
                payload, reason = build_svl_payload(svl)

                if not payload:
                    ref = find_reference_from_svl(svl)
                    if ref.startswith("WH/IN/"):
                        skipped_return += 1
                    else:
                        skipped_stock += 1
                    last_svl_id = svl.id
                    continue

                ok, status_code, body = send_payload(session, payload)

                if ok:
                    if payload["type"] == "stock_return":
                        sent_return += 1
                    else:
                        sent_stock += 1
                else:
                    errors += 1
                    print("❌ SVL %s falhou | HTTP %s | %s" % (svl.id, status_code, body))

                last_svl_id = svl.id
                time.sleep(API_SLEEP_BETWEEN_REQUESTS)

            except Exception as e:
                errors += 1
                last_svl_id = getattr(svl, "id", last_svl_id)
                print("❌ Erro SVL %s: %s" % (getattr(svl, "id", "N/A"), str(e)))

        print(
            "📊 Lote Stock %s | ultimo_id=%s | saidas=%s | devolucoes=%s | ign.saidas=%s | ign.devolucoes=%s | erros=%s"
            % (
                stock_batch_num,
                last_svl_id,
                sent_stock,
                sent_return,
                skipped_stock,
                skipped_return,
                errors,
            )
        )

        time.sleep(API_SLEEP_BETWEEN_BATCHES)

    except Exception as e:
        errors += 1
        print("❌ Erro no lote Stock após id %s: %s" % (last_svl_id, str(e)))
        time.sleep(API_RETRY_SLEEP)

print("✅ Stock finalizado | saidas=%s | devolucoes=%s | ign.saidas=%s | ign.devolucoes=%s | erros=%s" % (
    sent_stock, sent_return, skipped_stock, skipped_return, errors
))

print("🏁 FINALIZADO")
print(
    "Resumo -> Vendor Bills=%s | Stock Out=%s | Stock Return=%s | Ignorados Vendor=%s | Ignorados Stock=%s | Ignorados Return=%s | Erros=%s"
    % (sent_vendor, sent_stock, sent_return, skipped_vendor, skipped_stock, skipped_return, errors)
)