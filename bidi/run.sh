#!/bin/bash

cleanup() {

    # Function to kill a process by its name
    kill_process() {
        local process_name="$1"
        local pid
        pid=$(pgrep -f "$process_name")
    
        if [ -n "$pid" ]; then
            echo "Killing process: $process_name with PID: $pid"
            kill "$pid"
            # Optional: wait for the process to terminate
            wait "$pid" 2>/dev/null
        else
            echo "No process found for: $process_name"
        fi
    }
    
    # Step 1: Check for 'node client.ts' process and kill it if exists
    kill_process "node client.ts"
    
    # Step 2: Check for Gecko WebDriver running on port 4444 and kill it if exists
    gecko_pid=$(lsof -ti :4444)
    if [ -n "$gecko_pid" ]; then
        echo "Killing Gecko WebDriver process with PID: $gecko_pid"
        kill "$gecko_pid"
        wait "$gecko_pid" 2>/dev/null
    else
        echo "No Gecko WebDriver process found on port 4444"
    fi
    
    
    other_pid=$(lsof -ti :9222)
    if [ -n "$other_pid" ]; then
        echo "Killing browser process listening on port 9222: $other_pid"
        kill "$other_pid"
        wait "$other_pid" 2>/dev/null
    else
        echo "No browser process found listening on port 9222"
    fi

}

setup_manual() {

    cleanup

    echo "Starting Gecko WebDriver..."
    scripts/start_geckodriver.sh > /tmp/gecko_driver.log 2>&1 &
    gecko_driver_pid=$!
    
    sleep 3
    
    node inspect client.ts

    cleanup
}

run() {
    echo "Cleaning up old tests"
    cleanup
    echo "Running test"
    setup_automatic
    sleep 7
    echo "Cleaning test"
    cleanup
    echo "Done"
}

run
#setup_manual
