
import sys
import os
from pathlib import Path

# Add current directory to path so we can import smtp_utils
sys.path.insert(0, os.getcwd())

try:
    from smtp_utils import resolve_smtp_settings, send_email_via_smtp
except ImportError:
    # Try importing assuming we are in the root and smtp_utils is there
    try:
        import smtp_utils
        from smtp_utils import resolve_smtp_settings, send_email_via_smtp
    except ImportError as e:
        print(f"Could not import smtp_utils: {e}")
        sys.exit(1)

print("Resolving SMTP settings...")
settings = resolve_smtp_settings()
print(f"Settings found: Host={settings.get('host')}, Port={settings.get('port')}, Sender={settings.get('sender')}, Recipients={settings.get('recipients')}")

print("\nAttempting to send test email...")
success, msg = send_email_via_smtp(
    subject="Test Email from Debug Script",
    body_lines=["This is a test email."],
    smtp_settings=settings,
    success_message="Email sent successfully"
)

if success:
    print("\nSUCCESS: Email sent.")
else:
    print(f"\nFAILURE: {msg}")
