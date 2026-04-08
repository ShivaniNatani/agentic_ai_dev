#!/bin/bash
# Pre-deployment checklist script
# Run this before deploying to verify all required files are present

echo "🔍 MLOps Dashboard Deployment Readiness Check"
echo "=============================================="
echo ""

# Track missing files
MISSING_FILES=0

# Essential files
REQUIRED_FILES=(
    "Dockerfile"
    "docker-entrypoint.sh"
    "dashboard_observatory.py"
    "fetch_live_data.py"
    "automated_monitor.py"
    "monitor_http.py"
    "smtp_utils.py"
    "requirements.txt"
    "cloudbuild.yaml"
    "mlflow-sa.json"
)

echo "✓ Checking required files..."
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file MISSING!"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

echo ""
echo "✓ Checking optional files..."
OPTIONAL_FILES=("config.ini" "Jenkinsfile" "jenkins-setup.md")
for file in "${OPTIONAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  📄 $file (optional)"
    fi
done

echo ""
echo "✓ Verifying no test files remain..."
TEST_FILES=("test_flow.py" "test_flow_v2.py" "test_consolidated.py" "dashboard.py.bak")
TEST_FOUND=0
for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ⚠️  $file (should be removed)"
        TEST_FOUND=$((TEST_FOUND + 1))
    fi
done

if [ $TEST_FOUND -eq 0 ]; then
    echo "  ✅ No test files found (clean)"
fi

echo ""
echo "✓ Checking Python syntax..."
python3 -m py_compile dashboard_observatory.py fetch_live_data.py automated_monitor.py smtp_utils.py 2>/dev/null
if [ $? -eq 0 ]; then
    echo "  ✅ All Python files compile successfully"
else
    echo "  ❌ Python syntax errors detected"
    MISSING_FILES=$((MISSING_FILES + 1))
fi

echo ""
echo "=============================================="
if [ $MISSING_FILES -eq 0 ] && [ $TEST_FOUND -eq 0 ]; then
    echo "✅ DEPLOYMENT READY - All checks passed!"
    echo ""
    echo "Next steps:"
    echo "  1. Review mlflow-sa.json credentials"
    echo "  2. Update cloudbuild.yaml with your project ID"
    echo "  3. Run: gcloud builds submit --config cloudbuild.yaml"
    exit 0
else
    echo "❌ DEPLOYMENT BLOCKED - Fix issues above"
    exit 1
fi
