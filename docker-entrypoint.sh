#!/bin/sh
set -e

# Create a hash of the package files if they exist
if [ -f package.json ]; then
  PACKAGE_HASH_OLD=$(md5sum package.json 2>/dev/null || echo "")
  if [ -f package-lock.json ]; then
    LOCK_HASH_OLD=$(md5sum package-lock.json 2>/dev/null || echo "")
  fi
fi

# Function to check if packages need to be installed
check_and_install() {
  if [ -f package.json ]; then
    # Check if node_modules doesn't exist or package files have changed
    if [ ! -d "node_modules" ] || \
       [ "$(md5sum package.json 2>/dev/null || echo "")" != "$PACKAGE_HASH_OLD" ] || \
       ([ -f package-lock.json ] && [ "$(md5sum package-lock.json 2>/dev/null || echo "")" != "$LOCK_HASH_OLD" ]); then

      echo "📦 Installing or updating npm packages..."
      npm ci

      # Update hashes after installation
      PACKAGE_HASH_OLD=$(md5sum package.json 2>/dev/null || echo "")
      if [ -f package-lock.json ]; then
        LOCK_HASH_OLD=$(md5sum package-lock.json 2>/dev/null || echo "")
      fi

      echo "✅ Packages installed successfully!"
    fi
  fi
}

# Initial package installation
check_and_install

# Start the application with periodic checks for package changes
if [ "${1#npm run}" != "$1" ]; then
  # If command starts with npm run, execute it with package checking
  # Loop in the background to check for package changes
  (
    while true; do
      sleep 10
      check_and_install
    done
  ) &

  # Execute the original command
  exec "$@"
else
  # For any other command, just execute it
  exec "$@"
fi