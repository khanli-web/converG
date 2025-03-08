import os
import re
from flask import Flask, render_template, request, jsonify
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import qobuz
import requests
from datetime import datetime

app = Flask(__name__)

# Load environment variables
SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET')
QOBUZ_APP_ID = os.environ.get('QOBUZ_APP_ID')
QOBUZ_APP_SECRET = os.environ.get('QOBUZ_APP_SECRET')

# Initialize Spotify client
spotify = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET
))

# Initialize Qobuz client
qobuz_client = qobuz.Client(app_id=QOBUZ_APP_ID, app_secret=QOBUZ_APP_SECRET)


def extract_spotify_info(link):
    """Extract metadata from Spotify link"""
    spotify_id_pattern = r'(track|album|artist)/([a-zA-Z0-9]+)'
    match = re.search(spotify_id_pattern, link)
    
    if not match:
        return None, None, None
    
    item_type, item_id = match.groups()
    
    try:
        if item_type == 'track':
            track = spotify.track(item_id)
            return 'track', {
                'title': track['name'],
                'artist': track['artists'][0]['name'],
                'album': track['album']['name'],
                'duration_ms': track['duration_ms'],
                'release_date': track['album']['release_date'],
                'original_link': link
            }, item_id
        elif item_type == 'album':
            album = spotify.album(item_id)
            return 'album', {
                'title': album['name'],
                'artist': album['artists'][0]['name'],
                'release_date': album['release_date'],
                'tracks': len(album['tracks']['items']),
                'original_link': link
            }, item_id
        elif item_type == 'artist':
            artist = spotify.artist(item_id)
            return 'artist', {
                'name': artist['name'],
                'genres': artist['genres'],
                'original_link': link
            }, item_id
    except Exception as e:
        print(f"Error extracting Spotify info: {e}")
        return None, None, None


def extract_qobuz_info(link):
    """Extract metadata from Qobuz link"""
    qobuz_id_pattern = r'(track|album|artist)/([0-9]+)'
    match = re.search(qobuz_id_pattern, link)
    
    if not match:
        return None, None, None
    
    item_type, item_id = match.groups()
    
    try:
        if item_type == 'track':
            track = qobuz_client.get_track_by_id(item_id)
            return 'track', {
                'title': track['title'],
                'artist': track['performer']['name'],
                'album': track['album']['title'],
                'duration_ms': track['duration'] * 1000,  # Convert seconds to ms
                'release_date': track['album']['released_at'],
                'original_link': link
            }, item_id
        elif item_type == 'album':
            album = qobuz_client.get_album_by_id(item_id)
            return 'album', {
                'title': album['title'],
                'artist': album['artist']['name'],
                'release_date': album['released_at'],
                'tracks': album['tracks_count'],
                'original_link': link
            }, item_id
        elif item_type == 'artist':
            artist = qobuz_client.get_artist_by_id(item_id)
            return 'artist', {
                'name': artist['name'],
                'genres': [genre['name'] for genre in artist.get('genres', [])],
                'original_link': link
            }, item_id
    except Exception as e:
        print(f"Error extracting Qobuz info: {e}")
        return None, None, None


def search_spotify(metadata, item_type):
    """Search for matching content on Spotify"""
    try:
        if item_type == 'track':
            # Search for track by title and artist
            query = f"track:{metadata['title']} artist:{metadata['artist']}"
            results = spotify.search(query, type='track', limit=5)
            
            tracks = results['tracks']['items']
            for track in tracks:
                # Verify by title and duration (allowing 3 second difference)
                if (track['name'].lower() == metadata['title'].lower() and 
                    abs(track['duration_ms'] - metadata['duration_ms']) < 3000):
                    return {
                        'title': track['name'],
                        'artist': track['artists'][0]['name'],
                        'album': track['album']['name'],
                        'link': track['external_urls']['spotify']
                    }
        
        elif item_type == 'album':
            # Search for album by title and artist
            query = f"album:{metadata['title']} artist:{metadata['artist']}"
            results = spotify.search(query, type='album', limit=5)
            
            albums = results['albums']['items']
            for album in albums:
                # Format dates to compare
                album_date = datetime.strptime(album['release_date'], '%Y-%m-%d' 
                                              if len(album['release_date']) == 10 
                                              else '%Y')
                metadata_date = datetime.strptime(metadata['release_date'], '%Y-%m-%d' 
                                                 if len(metadata['release_date']) == 10 
                                                 else '%Y')
                
                # Verify by title and release date (allowing 30 days difference)
                if (album['name'].lower() == metadata['title'].lower() and 
                    abs((album_date - metadata_date).days) < 30):
                    return {
                        'title': album['name'],
                        'artist': album['artists'][0]['name'],
                        'link': album['external_urls']['spotify']
                    }
        
        elif item_type == 'artist':
            # Search for artist by name
            query = f"artist:{metadata['name']}"
            results = spotify.search(query, type='artist', limit=5)
            
            artists = results['artists']['items']
            for artist in artists:
                # Verify by name
                if artist['name'].lower() == metadata['name'].lower():
                    return {
                        'name': artist['name'],
                        'link': artist['external_urls']['spotify']
                    }
    
    except Exception as e:
        print(f"Error searching Spotify: {e}")
    
    return None


def search_qobuz(metadata, item_type):
    """Search for matching content on Qobuz"""
    try:
        if item_type == 'track':
            # Search for track
            query = f"{metadata['title']} {metadata['artist']}"
            results = qobuz_client.search(query, 'tracks')
            
            for track in results.get('tracks', {}).get('items', []):
                # Verify by title and duration (allowing 3 second difference)
                track_duration_ms = track['duration'] * 1000  # Convert seconds to ms
                if (track['title'].lower() == metadata['title'].lower() and 
                    abs(track_duration_ms - metadata['duration_ms']) < 3000):
                    return {
                        'title': track['title'],
                        'artist': track['performer']['name'],
                        'album': track['album']['title'],
                        'link': f"https://open.qobuz.com/track/{track['id']}"
                    }
        
        elif item_type == 'album':
            # Search for album
            query = f"{metadata['title']} {metadata['artist']}"
            results = qobuz_client.search(query, 'albums')
            
            for album in results.get('albums', {}).get('items', []):
                # Format dates to compare
                album_date = datetime.strptime(album['released_at'], '%Y-%m-%d')
                metadata_date = datetime.strptime(metadata['release_date'], '%Y-%m-%d' 
                                                if len(metadata['release_date']) == 10 
                                                else '%Y')
                
                # Verify by title and release date (allowing 30 days difference)
                if (album['title'].lower() == metadata['title'].lower() and 
                    abs((album_date - metadata_date).days) < 30):
                    return {
                        'title': album['title'],
                        'artist': album['artist']['name'],
                        'link': f"https://open.qobuz.com/album/{album['id']}"
                    }
        
        elif item_type == 'artist':
            # Search for artist
            query = metadata['name']
            results = qobuz_client.search(query, 'artists')
            
            for artist in results.get('artists', {}).get('items', []):
                # Verify by name
                if artist['name'].lower() == metadata['name'].lower():
                    return {
                        'name': artist['name'],
                        'link': f"https://open.qobuz.com/artist/{artist['id']}"
                    }
    
    except Exception as e:
        print(f"Error searching Qobuz: {e}")
    
    return None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/convert', methods=['POST'])
def convert():
    data = request.json
    link = data.get('link')
    
    if not link:
        return jsonify({'error': 'No link provided'}), 400
    
    # Determine the source platform
    if 'spotify.com' in link:
        item_type, metadata, item_id = extract_spotify_info(link)
        if not metadata:
            return jsonify({'error': 'Invalid Spotify link'}), 400
        
        result = search_qobuz(metadata, item_type)
        platform = 'qobuz'
    
    elif 'qobuz.com' in link:
        item_type, metadata, item_id = extract_qobuz_info(link)
        if not metadata:
            return jsonify({'error': 'Invalid Qobuz link'}), 400
        
        result = search_spotify(metadata, item_type)
        platform = 'spotify'
    
    else:
        return jsonify({'error': 'Unsupported link format'}), 400
    
    if not result:
        return jsonify({
            'error': 'No matching content found',
            'metadata': metadata
        }), 404
    
    return jsonify({
        'success': True,
        'platform': platform,
        'type': item_type,
        'original': metadata,
        'result': result
    })


if __name__ == '__main__':
    app.run(debug=True)