import requests
import os
from fastapi import HTTPException, status

class PaystackService:
    BASE_URL = "https://api.paystack.co"
    
    @property
    def headers(self):
        secret_key = os.getenv("PAYSTACK_SECRET_KEY")
        if not secret_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Paystack secret key not configured"
            )
        return {
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json"
        }

    def verify_transaction(self, reference: str):
        url = f"{self.BASE_URL}/transaction/verify/{reference}"
        response = requests.get(url, headers=self.headers)
        if response.status_code == 200:
            return response.json()
        return None

    def create_transfer_recipient(self, name: str, account_number: str, bank_code: str):
        """Create a transfer recipient on Paystack"""
        url = f"{self.BASE_URL}/transferrecipient"
        data = {
            "type": "nuban",
            "name": name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": "NGN"
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code in [200, 201]:
            result = response.json()
            if result["status"]:
                return result["data"]["recipient_code"]
        
        # Log error or details
        print(f"Paystack recipient creation failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not verify bank account details: {response.json().get('message', 'Unknown error')}"
        )

    def initiate_transfer(self, amount: float, recipient_code: str, reference: str, reason: str = "Vendor Payout"):
        """Initiate a transfer to the vendor"""
        url = f"{self.BASE_URL}/transfer"
        data = {
            "source": "balance", 
            "amount": int(amount * 100), # Convert to kobo
            "recipient": recipient_code,
            "reference": f"TRF_{reference}",
            "reason": reason
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code in [200, 201]:
            return response.json()
            
        print(f"Paystack transfer failed: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payout failed: {response.json().get('message', 'Unknown error')}"
        )
        
    def resolve_account_number(self, account_number: str, bank_code: str):
        """Verify account number"""
        url = f"{self.BASE_URL}/bank/resolve?account_number={account_number}&bank_code={bank_code}"
        response = requests.get(url, headers=self.headers)
        print(f"[Paystack resolve] status={response.status_code} body={response.text}")
        if response.status_code == 200:
            return response.json()
        try:
            return {"status": False, "paystack_message": response.json().get("message", "")}
        except Exception:
            return {"status": False, "paystack_message": response.text}

    def get_banks(self):
        """Get list of banks"""
        url = f"{self.BASE_URL}/bank?currency=NGN"
        response = requests.get(url, headers=self.headers)
        if response.status_code == 200:
            return response.json()
        return None

paystack_service = PaystackService()
