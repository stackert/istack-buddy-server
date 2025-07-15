#!/bin/bash

# Script to view and analyze Slack event logs
# Usage: ./view-slack-logs.sh [options]

LOG_DIR="docs-living/debug-logging/conversations"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔍 Slack Event Log Viewer"
echo "========================="
echo "Log directory: $PROJECT_ROOT/$LOG_DIR"
echo ""

# Check if log directory exists
if [ ! -d "$PROJECT_ROOT/$LOG_DIR" ]; then
    echo "❌ Log directory not found: $PROJECT_ROOT/$LOG_DIR"
    echo "💡 Start your server and send a Slack event to generate logs"
    exit 1
fi

# Function to display usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -l, --list          List all Slack event logs"
    echo "  -r, --recent        Show the most recent Slack event log"
    echo "  -w, --watch         Watch for new Slack event logs (tail -f style)"
    echo "  -c, --count         Count total number of events"
    echo "  -s, --stats         Show statistics about events"
    echo "  -f, --file FILE     View specific log file"
    echo "  -t, --type TYPE     Filter by event type (app_mention, etc.)"
    echo "  -d, --duplicates    Show potential duplicate events"
    echo ""
    echo "Examples:"
    echo "  $0 -l                    # List all logs"
    echo "  $0 -r                    # Show most recent event"
    echo "  $0 -f 1704110400.slack.log.json  # View specific file"
    echo "  $0 -t app_mention        # Filter app_mention events"
    echo "  $0 -d                    # Show duplicate analysis"
}

# Function to list all slack log files
list_logs() {
    echo "📋 Available Slack Event Logs:"
    echo "==============================="
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    slack_logs=($(ls -t *.slack.log.json 2>/dev/null))
    
    if [ ${#slack_logs[@]} -eq 0 ]; then
        echo "No Slack event logs found."
        echo "💡 Send a message to your Slack bot to generate logs"
        return
    fi
    
    for log in "${slack_logs[@]}"; do
        if [ -f "$log" ]; then
            # Extract timestamp from filename
            timestamp=$(echo "$log" | sed 's/.slack.log.json$//')
            human_date=$(date -d "@$timestamp" 2>/dev/null || date -r "$timestamp" 2>/dev/null || echo "Unknown")
            
            # Get event type from JSON
            event_type=$(jq -r '.eventAnalysis.eventType // "unknown"' "$log" 2>/dev/null)
            event_id=$(jq -r '.eventAnalysis.eventId // "none"' "$log" 2>/dev/null)
            user=$(jq -r '.eventDetails.user // "unknown"' "$log" 2>/dev/null)
            
            echo "  📄 $log"
            echo "      Date: $human_date"
            echo "      Type: $event_type"
            echo "      Event ID: $event_id"
            echo "      User: $user"
            echo ""
        fi
    done
}

# Function to show the most recent log
show_recent() {
    echo "🕐 Most Recent Slack Event:"
    echo "=========================="
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    recent_log=$(ls -t *.slack.log.json 2>/dev/null | head -1)
    
    if [ -z "$recent_log" ]; then
        echo "No Slack event logs found."
        return
    fi
    
    echo "File: $recent_log"
    echo ""
    
    # Pretty print the JSON
    if command -v jq >/dev/null 2>&1; then
        jq '.' "$recent_log"
    else
        cat "$recent_log"
    fi
}

# Function to watch for new logs
watch_logs() {
    echo "👀 Watching for new Slack events..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    
    # Use inotifywait if available, otherwise fallback to polling
    if command -v inotifywait >/dev/null 2>&1; then
        inotifywait -m -e create --format '%f' . 2>/dev/null | while read file; do
            if [[ "$file" == *.slack.log.json ]]; then
                echo "🆕 New Slack event: $file"
                
                # Extract key info
                if [ -f "$file" ] && command -v jq >/dev/null 2>&1; then
                    event_type=$(jq -r '.eventAnalysis.eventType // "unknown"' "$file" 2>/dev/null)
                    user=$(jq -r '.eventDetails.user // "unknown"' "$file" 2>/dev/null)
                    text_preview=$(jq -r '.eventDetails.textPreview // "none"' "$file" 2>/dev/null)
                    
                    echo "   Type: $event_type"
                    echo "   User: $user"
                    echo "   Message: $text_preview"
                    echo ""
                fi
            fi
        done
    else
        # Fallback to polling
        last_count=0
        while true; do
            current_count=$(ls -1 *.slack.log.json 2>/dev/null | wc -l)
            if [ "$current_count" -gt "$last_count" ]; then
                echo "🆕 New Slack event detected (total: $current_count)"
                last_count=$current_count
            fi
            sleep 2
        done
    fi
}

# Function to count events
count_events() {
    echo "📊 Slack Event Statistics:"
    echo "========================="
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    total_events=$(ls -1 *.slack.log.json 2>/dev/null | wc -l)
    
    echo "Total events: $total_events"
    
    if [ "$total_events" -eq 0 ]; then
        return
    fi
    
    # Count by event type
    echo ""
    echo "Events by type:"
    if command -v jq >/dev/null 2>&1; then
        for log in *.slack.log.json; do
            jq -r '.eventAnalysis.eventType // "unknown"' "$log" 2>/dev/null
        done | sort | uniq -c | sort -nr
    fi
    
    # Show date range
    echo ""
    echo "Date range:"
    oldest=$(ls -t *.slack.log.json | tail -1)
    newest=$(ls -t *.slack.log.json | head -1)
    
    if [ -n "$oldest" ]; then
        oldest_ts=$(echo "$oldest" | sed 's/.slack.log.json$//')
        oldest_date=$(date -d "@$oldest_ts" 2>/dev/null || date -r "$oldest_ts" 2>/dev/null || echo "Unknown")
        echo "  Oldest: $oldest_date"
    fi
    
    if [ -n "$newest" ]; then
        newest_ts=$(echo "$newest" | sed 's/.slack.log.json$//')
        newest_date=$(date -d "@$newest_ts" 2>/dev/null || date -r "$newest_ts" 2>/dev/null || echo "Unknown")
        echo "  Newest: $newest_date"
    fi
}

# Function to show specific file
show_file() {
    local file="$1"
    
    echo "📄 Viewing: $file"
    echo "=================="
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    
    if [ ! -f "$file" ]; then
        echo "❌ File not found: $file"
        return 1
    fi
    
    # Pretty print the JSON
    if command -v jq >/dev/null 2>&1; then
        jq '.' "$file"
    else
        cat "$file"
    fi
}

# Function to filter by event type
filter_by_type() {
    local event_type="$1"
    
    echo "🔍 Events of type: $event_type"
    echo "============================="
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    
    if command -v jq >/dev/null 2>&1; then
        for log in *.slack.log.json; do
            if [ -f "$log" ]; then
                actual_type=$(jq -r '.eventAnalysis.eventType // "unknown"' "$log" 2>/dev/null)
                if [ "$actual_type" = "$event_type" ]; then
                    echo "📄 $log"
                    jq -r '.eventDetails.textPreview // "no text"' "$log" 2>/dev/null
                    echo ""
                fi
            fi
        done
    else
        echo "❌ jq is required for filtering. Please install jq."
    fi
}

# Function to analyze duplicates
analyze_duplicates() {
    echo "🔍 Duplicate Event Analysis:"
    echo "============================"
    
    cd "$PROJECT_ROOT/$LOG_DIR"
    
    if command -v jq >/dev/null 2>&1; then
        echo "Content hashes (duplicates will have same hash):"
        for log in *.slack.log.json; do
            if [ -f "$log" ]; then
                content_hash=$(jq -r '.duplicateDetection.contentHash // "none"' "$log" 2>/dev/null)
                echo "$content_hash $log"
            fi
        done | sort | uniq -c | sort -nr
        
        echo ""
        echo "Event IDs (should be unique):"
        for log in *.slack.log.json; do
            if [ -f "$log" ]; then
                event_id=$(jq -r '.eventAnalysis.eventId // "none"' "$log" 2>/dev/null)
                echo "$event_id $log"
            fi
        done | sort | uniq -c | sort -nr
    else
        echo "❌ jq is required for duplicate analysis. Please install jq."
    fi
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_usage
        ;;
    -l|--list)
        list_logs
        ;;
    -r|--recent)
        show_recent
        ;;
    -w|--watch)
        watch_logs
        ;;
    -c|--count)
        count_events
        ;;
    -s|--stats)
        count_events
        ;;
    -f|--file)
        if [ -z "$2" ]; then
            echo "❌ Please specify a file name"
            echo "Usage: $0 -f <filename>"
            exit 1
        fi
        show_file "$2"
        ;;
    -t|--type)
        if [ -z "$2" ]; then
            echo "❌ Please specify an event type"
            echo "Usage: $0 -t <event_type>"
            exit 1
        fi
        filter_by_type "$2"
        ;;
    -d|--duplicates)
        analyze_duplicates
        ;;
    "")
        # No arguments - show recent by default
        show_recent
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac 