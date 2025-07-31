#!/bin/bash

# Script to kill all node processes related to istack-buddy project
# Usage: ./kill-all-servers

echo "🔍 Searching for istack-buddy node processes..."

# Find all node processes containing "istack-buddy" in their command or path
PIDS=$(ps aux | grep -i "node.*istack-buddy" | grep -v grep | awk '{print $2}')

if [ -z "$PIDS" ]; then
    echo "✅ No istack-buddy node processes found running."
    exit 0
fi

echo "📋 Found the following istack-buddy node processes:"
ps aux | grep -i "node.*istack-buddy" | grep -v grep | while read line; do
    echo "  $line"
done

echo ""
echo "🔪 Killing processes..."

# Kill each process
for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
        echo "  Killing process $pid..."
        kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
        
        # Wait a moment and check if process is still running
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
            echo "  ⚠️  Process $pid still running, force killing..."
            kill -KILL "$pid" 2>/dev/null
        else
            echo "  ✅ Process $pid terminated successfully"
        fi
    else
        echo "  ⚠️  Process $pid no longer exists"
    fi
done

echo ""
echo "🔍 Verifying all processes are killed..."
REMAINING_PIDS=$(ps aux | grep -i "node.*istack-buddy" | grep -v grep | awk '{print $2}')

if [ -z "$REMAINING_PIDS" ]; then
    echo "✅ All istack-buddy node processes have been successfully terminated."
else
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -i "node.*istack-buddy" | grep -v grep
fi

echo "🏁 Script completed." 