"""
HTTP endpoint wrapper for automated monitoring.
This allows Cloud Scheduler to trigger the monitoring job via HTTP POST.
"""
from flask import Flask, request, jsonify
import subprocess
import os

app = Flask(__name__)

@app.route("/")
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "mlops-monitor"}), 200

@app.route("/run-monitor", methods=["POST"])
def run_monitor():
    """
    Trigger the automated monitoring job.
    
    Expected JSON body (optional):
    {
        "days": 7,
        "email_type": "consolidated"
    }
    """
    # Get parameters from request body
    data = request.get_json() or {}
    days = data.get("days", 7)
    email_type = data.get("email_type", "consolidated")
    
    # Validate email_type
    if email_type not in ["consolidated", "client"]:
        return jsonify({
            "status": "error",
            "message": f"Invalid email_type: {email_type}. Must be 'consolidated' or 'client'."
        }), 400
    
    try:
        # Run the monitoring script
        result = subprocess.run(
            ["python3", "/app/automated_monitor.py", "--days", str(days), "--email-type", email_type],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            return jsonify({
                "status": "success",
                "message": f"Monitoring job completed successfully",
                "days": days,
                "email_type": email_type,
                "output": result.stdout
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Monitoring job failed",
                "error": result.stderr,
                "output": result.stdout
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            "status": "error",
            "message": "Monitoring job timed out after 5 minutes"
        }), 504
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to run monitoring job: {str(e)}"
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
