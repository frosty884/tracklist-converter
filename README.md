# Tracklist Converter

Tracklist Converter is a Node.js and TypeScript application that transforms messy, unorganized tracklists into a clean CSV file. It automatically removes timestamps, parses your input into song title and artist (using user‐defined field order), and leverages the SoundCloud API (via the soundcloud.ts library) to verify or auto-correct track details. When needed, it also offers multiple fallback options (including fuzzy matching, custom search queries, and even a Google search link) to ensure your final CSV is as accurate as possible.

## Features

- **Timestamp Removal:** Automatically strips leading timestamps from each input line.
- **Flexible Parsing:** Let the user choose whether the first field is the title or the artist.
- **SoundCloud Search:** Searches SoundCloud for each track using a combination of title and artist.
- **Fuzzy Matching:** Auto-accepts close matches, even if there are slight variations in spacing or capitalization.
- **Fallback Options:** Offers options such as searching only by title, using the opposite field order, entering a custom query, or manually entering track details.
- **CSV Output:** Generates a CSV file with columns: Title, Artist, Album, and Duration.
- **User-Friendly Prompts:** Uses an external editor for multi-line input and interactive prompts for track confirmation.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/frosty884/tracklist-converter.git
   cd tracklist-converter
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**

   Create a `.env` file in the root directory and add your SoundCloud credentials:

   ```env
   SOUNDCLOUD_CLIENT_ID=your_client_id_here
   SOUNDCLOUD_OAUTH_TOKEN=your_oauth_token_here
   ```

## Usage

1. **Compile the TypeScript code:**

   ```bash
   npx tsc
   ```

2. **Run the application:**

   ```bash
   node dist/app.js
   ```

3. **Follow the interactive prompts:**

   - Decide whether the first field in your tracklist is the artist or the title.
   - Paste your tracklist into the opened editor (the app will automatically strip timestamps).
   - Confirm or adjust each track using the provided SoundCloud search results and fallback options.
   - Finally, enter a playlist name when prompted—this name will be used for the output CSV file.

## Contributing

Contributions are welcome! Feel free to submit pull requests or open issues if you have any suggestions or improvements.

## License

This project is licensed under the [MIT License](LICENSE).