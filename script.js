// Event listener for the convert button
document.getElementById('convertBtn').addEventListener('click', async function() {
    const link = document.getElementById('inputLink').value.trim();
    const resultDiv = document.getElementById('result');

    // Clear previous results and validate input
    resultDiv.innerHTML = '';
    if (!link) {
        resultDiv.innerText = 'Please enter a link.';
        return;
    }

    // Detect service based on the link
    if (link.includes('qobuz.com')) {
        await convertQobuzLink(link);
    } else if (link.includes('spotify.com')) {
        await convertSpotifyLink(link);
    } else {
        resultDiv.innerText = 'Invalid link. Please enter a Qobuz or Spotify link.';
    }
});

// Fetch metadata from Spotify using oEmbed
async function getSpotifyMetadata(link) {
    try {
        const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Spotify metadata');
        const data = await response.json();
        return data;
    } catch (error) {
        document.getElementById('result').innerText = 'Error fetching Spotify metadata.';
        return null;
    }
}

// Fetch metadata from Qobuz using oEmbed
async function getQobuzMetadata(link) {
    try {
        const url = `https://www.qobuz.com/api.json/0.2/oembed?url=${encodeURIComponent(link)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Qobuz metadata');
        const data = await response.json();
        return data;
    } catch (error) {
        document.getElementById('result').innerText = 'Error fetching Qobuz metadata.';
        return null;
    }
}

// Extract search query from metadata
function extractSearchQuery(metadata, link) {
    if (!metadata || !metadata.title) return null;

    let query = metadata.title;

    // For playlists, use playlist_name if available (assuming oEmbed provides it)
    if (link.includes('playlist') && metadata.playlist_name) {
        query = metadata.playlist_name;
    }

    return encodeURIComponent(query);
}

// Convert Spotify link to Qobuz search URL
async function convertSpotifyLink(link) {
    const metadata = await getSpotifyMetadata(link);
    if (!metadata) return;

    const query = extractSearchQuery(metadata, link);
    if (!query) {
        document.getElementById('result').innerText = 'Could not extract search terms.';
        return;
    }

    const searchUrl = `https://www.qobuz.com/us-en/search?q=${query}`;
    displayResult(searchUrl);
}

// Convert Qobuz link to Spotify search URL
async function convertQobuzLink(link) {
    const metadata = await getQobuzMetadata(link);
    if (!metadata) return;

    const query = extractSearchQuery(metadata, link);
    if (!query) {
        document.getElementById('result').innerText = 'Could not extract search terms.';
        return;
    }

    const searchUrl = `https://open.spotify.com/search/${query}`;
    displayResult(searchUrl);
}

// Display the result with a copy button
function displayResult(url) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <p>Search on the other service: <a href="${url}" target="_blank">${url}</a></p>
        <button id="copyBtn">Copy to Clipboard</button>
    `;

    document.getElementById('copyBtn').addEventListener('click', function() {
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copied to clipboard!');
        }).catch(() => {
            alert('Failed to copy link.');
        });
    });
}