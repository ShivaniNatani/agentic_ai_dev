import re

def infer_financial_class_from_payer(payer_name):
    if not payer_name or payer_name.lower() == "unknown":
        return "Unknown"
    p = payer_name.lower()
    if any(x in p for x in ["medicare", "mcr", "advantage"]):
        return "Medicare"
    elif any(x in p for x in ["medicaid", "mcd", "chip", "star", "ahcccs"]):
        return "Medicaid"
    elif any(x in p for x in ["tricare", "va ", "champ", "veteran"]):
        return "Government"
    elif any(x in p for x in ["self pay", "uninsured", "indigent"]):
        return "Self Pay"
    elif any(x in p for x in ["bcbs", "blue", "aetna", "cigna", "united", "humana", "commercial", "health", "plan", "network", "benefits", "mutual", "care", "ppo", "hmo", "epo"]):
        return "Commercial"
    return "Unknown"
