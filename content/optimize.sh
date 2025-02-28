#!/bin/bash

# Define the source and target directories
SOURCE_DIR=~/workspace-slider
TARGET_DIR=~/workspace-slider-dist

# Create the target directory structure
mkdir -p $TARGET_DIR/css
mkdir -p $TARGET_DIR/backgrounds
mkdir -p $TARGET_DIR/content

# Copy the necessary files
cp $SOURCE_DIR/index.html $TARGET_DIR/
cp $SOURCE_DIR/content/content.html $TARGET_DIR/content/

# Minify CSS
npx clean-css-cli -o $TARGET_DIR/css/styles.min.css $SOURCE_DIR/css/styles.css

# Minify JavaScript
npx uglify-js $SOURCE_DIR/main.mjs -o $TARGET_DIR/main.min.mjs
npx uglify-js $SOURCE_DIR/scrolling-content-div.mjs -o $TARGET_DIR/scrolling-content-div.min.mjs

# Optimize images
npx imagemin $SOURCE_DIR/backgrounds/milky-way-blue-seamless-bordered.jpg --out-dir=$TARGET_DIR/backgrounds/

# Update index.html to reference minified files
sed -i '' 's/css\/styles.css/css\/styles.min.css/' $TARGET_DIR/index.html
sed -i '' 's/main.mjs/main.min.mjs/' $TARGET_DIR/index.html

# Print completion message
echo "Optimization complete. Files are ready in $TARGET_DIR"