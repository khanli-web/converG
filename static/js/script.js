document.addEventListener('DOMContentLoaded', function() {
    const linkInput = document.getElementById('link-input');
    const convertBtn = document.getElementById('convert-btn');
    const loader = document.getElementById('loader');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    const resultLink = document.getElementById('result-link');
    const copyBtn = document.getElementById('copy-btn');
    const openLink = document.getElementById('open-link');
    const resultTitle = document.getElementById('result-title');
    const resultTypeBadge = document.getElementById('result-type-badge');
    const errorMessage = document.getElementById('error-message');
    const metadataComparison = document.getElementById('metadata-comparison');
    
    // Focus on input when page loads
    linkInput.focus();
    
    // Handle conversion button click
    convertBtn.addEventListener('click', function() {
        const link = linkInput.value.trim();
        
        if (!link) {
            showError('Please enter a Spotify or Qobuz link');
            return;
        }
        
        if (!isValidLink(link)) {
            showError('Please enter a valid Spotify or Qobuz link');
            return;
        }
        
        convertLink(link);
    });
    
    // Allow pressing Enter in the input field
    linkInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            convertBtn.click();
        }
    });
    
    // Handle copy button click
    copyBtn.addEventListener('click', function() {
        resultLink.select();
        document.execCommand('copy');
        
        // Show copied feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.disabled = true;
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.disabled = false;
        }, 2000);
    });
    
    // Validate link format
    function isValidLink(link) {
        return (
            link.includes('spotify.com') || 
            link.includes('qobuz.com')
        );
    }
    
    // Convert the link
    function convertLink(link) {
        // Show loader
        loader.classList.remove('hidden');
        result.classList.add('hidden');
        error.classList.add('hidden');
        
        // Call the API
        fetch('/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ link: link }),
        })
        .then(response => response.json())
        .then(data => {
            loader.classList.add('hidden');
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            displayResult(data);
        })
        .catch(err => {
            loader.classList.add('hidden');
            showError('An error occurred. Please try again.');
            console.error(err);
        });
    }
    
    // Display the error message
    function showError(message) {
        error.classList.remove('hidden');
        errorMessage.textContent = message;
        result.classList.add('hidden');
    }
    
    // Display the conversion result
    function displayResult(data) {
        result.classList.remove('hidden');
        
        // Set the result title and badge
        const platformName = data.platform === 'spotify' ? 'Spotify' : 'Qobuz';
        let typeName = '';
        
        switch (data.type) {
            case 'track':
                typeName = 'Track';
                break;
            case 'album':
                typeName = 'Album';
                break;
            case 'artist':
                typeName = 'Artist';
                break;
        }
        
        resultTitle.textContent = `Found on ${platformName}`;
        resultTypeBadge.textContent = typeName;
        resultTypeBadge.className = ''; // Reset classes
        resultTypeBadge.classList.add(data.platform);
        
        // Set the result link
        resultLink.value = data.result.link;
        openLink.href = data.result.link;
        
        // Generate metadata comparison HTML
        let metadataHTML = '<div class="metadata-comparison">';
        
        if (data.type === 'track') {
            metadataHTML += createMetadataItem('Title', data.result.title);
            metadataHTML += createMetadataItem('Artist', data.result.artist);
            metadataHTML += createMetadataItem('Album', data.result.album);
        } else if (data.type === 'album') {
            metadataHTML += createMetadataItem('Title', data.result.title);
            metadataHTML += createMetadataItem('Artist', data.result.artist);
        } else if (data.type === 'artist') {
            metadataHTML += createMetadataItem('Name', data.result.name);
        }
        
        metadataHTML += '</div>';
        
        // Add verification message
        const matchQuality = calculateMatchQuality(data);
        if (matchQuality < 100) {
            metadataHTML += `<div class="match-warning">⚠️ This might not be an exact match (${matchQuality}% confidence)</div>`;
        }
        
        metadataComparison.innerHTML = metadataHTML;
    }
    
    // Create a metadata item HTML
    function createMetadataItem(label, value) {
        return `
            <div class="metadata-item">
                <div class="metadata-label">${label}:</div>
                <div class="metadata-value">${value}</div>
            </div>
        `;
    }
    
    // Calculate match quality percentage (simple implementation)
    function calculateMatchQuality(data) {
        // This is a simplified calculation - in a real app you'd want more sophisticated comparison
        if (data.type === 'track') {
            const titleMatch = data.result.title.toLowerCase() === data.original.title.toLowerCase();
            const artistMatch = data.result.artist.toLowerCase().includes(data.original.artist.toLowerCase()) ||
                               data.original.artist.toLowerCase().includes(data.result.artist.toLowerCase());
            
            if (titleMatch && artistMatch) return 100;
            if (titleMatch) return 80;
            if (artistMatch) return 60;
            return 40;
        } else if (data.type === 'album') {
            const titleMatch = data.result.title.toLowerCase() === data.original.title.toLowerCase();
            const artistMatch = data.result.artist.toLowerCase().includes(data.original.artist.toLowerCase()) ||
                               data.original.artist.toLowerCase().includes(data.result.artist.toLowerCase());
            
            if (titleMatch && artistMatch) return 100;
            if (titleMatch) return 80;
            if (artistMatch) return 60;
            return 40;
        } else if (data.type === 'artist') {
            const nameMatch = data.result.name.toLowerCase() === data.original.name.toLowerCase();
            if (nameMatch) return 100;
            
            // Check for partial name match
            if (data.result.name.toLowerCase().includes(data.original.name.toLowerCase()) ||
                data.original.name.toLowerCase().includes(data.result.name.toLowerCase())) {
                return 80;
            }
            
            return 50;
        }
        
        return 60; // Default value
    }
});