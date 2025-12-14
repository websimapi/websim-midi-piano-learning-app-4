export class MidiLibrary {
    constructor(onMidiSelected) {
        this.onMidiSelected = onMidiSelected;
        this.midis = [];
        this.isOpen = false;
        this.isLoading = false;
        
        this.modal = document.getElementById('midi-library-modal');
        this.list = document.getElementById('midi-library-list');
        this.searchInput = document.getElementById('midi-library-search');
        this.closeBtn = document.getElementById('midi-library-close');
        this.openBtn = document.getElementById('open-library-btn');
        
        this.setupListeners();
    }
    
    setupListeners() {
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.open());
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.filterList(e.target.value));
        }
        
        // Close on click outside
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }
    }
    
    async open() {
        this.modal.classList.remove('hidden');
        this.isOpen = true;
        
        if (this.midis.length === 0 && !this.isLoading) {
            await this.fetchLibrary();
        }
        
        this.searchInput.focus();
    }
    
    close() {
        this.modal.classList.add('hidden');
        this.isOpen = false;
    }

    async fetchWithFallback(url) {
        // Strategy: Try Direct -> corsproxy.io -> allorigins.win -> thingproxy
        // We try direct first in case CORS is enabled, then fall back to proxies.
        const attempts = [
            { name: 'Direct', getUrl: (u) => u },
            { name: 'CorsProxy', getUrl: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
            { name: 'AllOrigins', getUrl: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
            { name: 'ThingProxy', getUrl: (u) => `https://thingproxy.freeboard.io/fetch/${u}` }
        ];

        let lastError;
        for (const attempt of attempts) {
            try {
                const fetchUrl = attempt.getUrl(url);
                const response = await fetch(fetchUrl);
                if (response.ok) {
                    return response;
                }
                console.warn(`${attempt.name} fetch failed: ${response.status}`);
            } catch (err) {
                console.warn(`${attempt.name} fetch error:`, err);
                lastError = err;
            }
        }
        throw lastError || new Error('All fetch attempts failed');
    }
    
    async fetchLibrary() {
        this.isLoading = true;
        this.list.innerHTML = '<div style="text-align:center; padding: 40px; color: #888;">Loading library...</div>';
        
        try {
            const response = await this.fetchWithFallback('https://midishare.dev/api/midis');
            if (!response.ok) throw new Error('Network error: ' + response.status);
            const data = await response.json();
            
            // Handle potentially wrapped response (e.g. { data: [...] } or just [...])
            if (Array.isArray(data)) {
                this.midis = data;
            } else if (data && Array.isArray(data.data)) {
                this.midis = data.data;
            } else if (data && typeof data === 'object') {
                // API returns a dictionary of midis (id -> object)
                this.midis = Object.values(data);
            } else {
                console.warn('Unexpected API response structure:', data);
                this.midis = [];
            }
            
            this.renderList(this.midis);
        } catch (error) {
            console.error('Error fetching MIDI library:', error);
            this.list.innerHTML = '<div style="text-align:center; padding: 40px; color: #ff6b6b;">Failed to load library. Please try again later.</div>';
        } finally {
            this.isLoading = false;
        }
    }
    
    renderList(items) {
        this.list.innerHTML = '';
        if (!items || !Array.isArray(items) || items.length === 0) {
            this.list.innerHTML = '<div style="text-align:center; padding: 40px; color: #888;">No MIDI files found.</div>';
            return;
        }
        
        // Limit to first 100 to prevent performance issues with large lists
        const itemsToShow = items.slice(0, 100);
        
        itemsToShow.forEach(midi => {
            const el = document.createElement('div');
            el.className = 'midi-item';
            el.innerHTML = `
                <div class="midi-info">
                    <h3>${midi.title || 'Untitled'}</h3>
                    <p>${midi.artist || 'Unknown Artist'}</p>
                </div>
                <button class="select-midi-btn" data-id="${midi.id}">Load</button>
            `;
            
            const loadBtn = el.querySelector('button');
            loadBtn.addEventListener('click', () => this.loadMidi(midi, loadBtn));
            this.list.appendChild(el);
        });
        
        if (items.length > 100) {
            const moreEl = document.createElement('div');
            moreEl.style.padding = '15px';
            moreEl.style.textAlign = 'center';
            moreEl.style.color = '#888';
            moreEl.style.fontSize = '12px';
            moreEl.textContent = `...and ${items.length - 100} more. Use search to find specific files.`;
            this.list.appendChild(moreEl);
        }
    }
    
    filterList(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            this.renderList(this.midis);
            return;
        }
        
        const filtered = this.midis.filter(m => 
            (m.title && m.title.toLowerCase().includes(q)) || 
            (m.artist && m.artist.toLowerCase().includes(q))
        );
        this.renderList(filtered);
    }
    
    async loadMidi(midiData, btnElement) {
        const originalText = btnElement.textContent;
        btnElement.textContent = 'Downloading...';
        btnElement.disabled = true;
        
        try {
            const url = `https://midishare.dev/api/midi?id=${midiData.id}&format=mid`;
            console.log('Downloading MIDI from:', url);

            const response = await this.fetchWithFallback(url);
            if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Pass the buffer to the app
            if (this.onMidiSelected) {
                await this.onMidiSelected(arrayBuffer, midiData.title);
            }
            
            this.close();
            
        } catch (error) {
            console.error('Error downloading MIDI:', error);
            btnElement.textContent = 'Error';
            setTimeout(() => {
                btnElement.textContent = originalText;
                btnElement.disabled = false;
            }, 2000);
        }
    }
}

