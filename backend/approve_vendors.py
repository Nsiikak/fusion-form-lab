#!/usr/bin/env python3
"""
Script to approve all pending vendors in the database.
This is useful for development/testing purposes.
"""
import app.entities  

from app.core.database import SessionLocal
from app.entities.vendor.model import Vendor, VerificationStatus

def approve_all_vendors():
    """Approve all pending vendors"""
    db = SessionLocal()
    try:
        # Get all pending vendors
        pending_vendors = db.query(Vendor).filter(
            Vendor.verification_status == VerificationStatus.PENDING
        ).all()
        
        if not pending_vendors:
            print("No pending vendors found.")
            return
        
        # Approve all pending vendors
        count = 0
        for vendor in pending_vendors:
            vendor.verification_status = VerificationStatus.APPROVED
            count += 1
            print(f"Approved vendor: {vendor.business_name} (ID: {vendor.id})")
        
        db.commit()
        print(f"\nSuccessfully approved {count} vendor(s).")
        
    except Exception as e:
        db.rollback()
        print(f"Error approving vendors: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    approve_all_vendors()



