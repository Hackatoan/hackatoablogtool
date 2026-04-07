# hackatoablogtool
updates my website blog
# Hackatoa CMS & Automation App Blueprint

## Overview
This document outlines the architecture and workflow for a standalone Admin/CMS repository designed to manage assets (songs, mushrooms, blog entries) for the `Hackatoan/hackatoa.com` portfolio website.

The goal is to provide a clean Web UI where you can upload files or write text, which will automatically map the files to the correct asset folders, reconstruct the data arrays (`songs-data.js`, `blog-data.js`, `mushrooms-data.js`), and commit + push those changes directly to GitHub so the main site effortlessly updates.

---

## Technical Architecture

*   **Stack:** Node.js backend (Express) with a lightweight frontend (vanilla DOM or React/Next.js) to provide the dashboard.
*   **Authentication:** Must be secured behind a basic password or GitHub OAuth so nobody else can upload to your portfolio.
*   **Hosting:** Can be hosted on Render, Heroku, or a cheap VPS. It needs a file system to clone your portfolio locally, make edits, and then push.
*   **Git Integration:** The server will maintain a `git clone` of the `Hackatoan/hackatoa.com` repo. When a user submits an upload:
    1.  The app pulls the latest `Main` branch.
    2.  It copies the uploaded file into `public/assets/...`
    3.  It runs the Node.js update scripts (like `node update-songs.js`).
    4.  It runs `git add .`, `git commit -m "Auto-update assets"`, and `git push origin Main` using a Personal Access Token.

---

## File & Data Structures to Manage

### 1. Songs (`public/assets/songs/`)
*   **Action:** When an `.mp3` or `.wav` is uploaded, save it to `public/assets/songs/`.
*   **Update Script:** Run the existing `node update-songs.js` to rewrite `public/songs-data.js`.

### 2. Mycology / Mushrooms (`public/assets/mycology/` or similar)
*   **Action:** When a mushroom picture is uploaded (with a title/description), save the image to the assets folder.
*   **Data File:** Update `public/mushrooms-data.js` to append the new image filename and metadata into the Javascript array.

### 3. Blog Entries ("Lava Log")
*   **Action:** A text area or markdown editor in the UI to write a new entry, add a title, and set a date.
*   **Image & Link Handling:** The CMS needs an endpoint to upload inline images to `public/assets/blog-media/` which returns the file's URL. The text editor should allow easily embedding these returned URLs, as well as embedding standard web URLs, directly into the entry content.
*   **Data File:** Update `public/blog-data.js` so the frontend `app.js` can dynamically render the new log into the `<div class="blog-list" id="blog-list"></div>`.

---

## Essential Dependencies for the New App
*   `express` (Web server to handle API routes and file uploads)
*   `multer` (Handling multipart/form-data for image/audio uploads)
*   `simple-git` (A Node.js wrapper for easily running Git commands locally)
*   `dotenv` (To easily manage your GitHub Personal Access Token)

---

## Running with Docker

You can easily run this CMS locally or on a VPS using Docker and Docker Compose. This ensures a consistent environment and automatically handles updates via Watchtower.

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```
2. **Configure your `.env` file:** Fill in your GitHub username, PAT, repo details, and set a strong `ADMIN_USERNAME` and `ADMIN_PASSWORD` for the CMS login.
3. **Start the containers:**
   ```bash
   docker-compose up -d
   ```
4. The CMS will now be accessible at `http://localhost:3000`.

---

## The AI Prompt

*Copy and paste the text below into the chat when you open the new workspace/repo for your CMS app.*

```text
I want to build a standalone Node.js Express dashboard app that acts as a headless CMS for my main portfolio website hosted on GitHub Pages (Hackatoan/hackatoa.com). I want to be able to upload files via a web UI and have the server automatically commit and push the changes to my GitHub repo.

Here are the requirements:
1. The app should have a very simple dashboard interface (HTML/CSS) behind basic password authentication to prevent unauthorized uploads.
2. It needs to handle file uploads via `multer`.
3. In the backend, the app should clone or maintain a local copy of my repository (Hackatoan/hackatoa.com).
4. Forms on the dashboard:
   - Music Upload: Uploads an .mp3 to `public/assets/songs/` and triggers a script `node update-songs.js` located in the repo.
   - Mushroom Upload: Uploads an image to the mycology assets folder and appends the data to `public/mushrooms-data.js`.
   - Blog Image Upload: An endpoint that accepts image uploads, saves them to `public/assets/blog-media/` and returns the file path or URL for use inside the editor.
   - Blog Post: A text or markdown editor to submit a title and content (allowing embedded image paths and links), which automatically updates the JS array in `public/blog-data.js`.
5. After an upload or blog creation happens, the server should use a library like `simple-git` or raw shell commands to:
   - `git pull origin Main`
   - Push the new asset and updated `.js` data arrays.
   - `git add .`, `git commit -m "Auto CMS Update"`, and `git push origin Main` using a GitHub Personal Access Token stored in an `.env` file.

Please scaffold out the `package.json`, `server.js`, and the `index.html` frontend for this. We will focus strictly on setting up the Express server and Git push pipeline first, so generate the code for that foundation.
```
