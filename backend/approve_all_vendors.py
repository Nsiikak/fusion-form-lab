"""
Approve all unverified vendors in the database.
Usage: python approve_all_vendors.py
"""
from app.core.database import SessionLocal
from app.entities.vendor.model import Vendor, VerificationStatus

db = SessionLocal()

pending = db.query(Vendor).filter(
    Vendor.verification_status != VerificationStatus.APPROVED
).all()

if not pending:
    print("No unverified vendors found.")
else:
    for vendor in pending:
        print(f"Approving: [{vendor.id}] {vendor.business_name} (was: {vendor.verification_status.value})")
        vendor.verification_status = VerificationStatus.APPROVED

    db.commit()
    print(f"\nDone — {len(pending)} vendor(s) approved.")

db.close()
