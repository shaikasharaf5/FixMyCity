# Twilio WhatsApp setup for CiviTrack

1. Install backend packages with `python -m pip install -r requirements.txt`.
2. Copy the values from `.env.example` into `.env` and replace the placeholders with the Twilio Account SID, Auth Token, WhatsApp sender, and public HTTPS URL.
3. Run the backend on port 8001 and expose it through a production HTTPS domain. For local testing, an HTTPS tunnel can be used.
4. In the Twilio WhatsApp Sandbox or WhatsApp Sender configuration, set **When a message comes in** to:
   `https://your-public-domain.example/api/integrations/twilio/whatsapp`
5. Select **HTTP POST** and save the sender configuration.

Citizen flow:

1. Send a clear issue photo to the Twilio WhatsApp number.
2. CiviTrack downloads the actual Twilio media and runs the project detector immediately.
3. If the photo contains GPS metadata, the complaint is registered immediately. Otherwise, CiviTrack asks the citizen to share their WhatsApp location.
4. The next location message creates the complaint, routes it to a department, and publishes it to the Central Room for officer assignment.

`TWILIO_VALIDATE_SIGNATURES` must stay `true` outside isolated local tests. The value of `TWILIO_WEBHOOK_URL` must exactly match the public URL configured in Twilio for signature validation.
