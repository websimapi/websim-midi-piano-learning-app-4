import { Midi } from 'tone';

export class MidiLoader {
    constructor() {
        this.midiData = null;
        this.rawMidiBuffer = null;
    }
    
    async loadMidi(fileOrBuffer, timeOffset = 5) {
        try {
            if (fileOrBuffer instanceof ArrayBuffer) {
                this.rawMidiBuffer = fileOrBuffer;
            } else {
                this.rawMidiBuffer = await fileOrBuffer.arrayBuffer();
            }

            // Verify header (Standard MIDI files start with MThd)
            const header = new Uint8Array(this.rawMidiBuffer, 0, 4);
            const headerStr = String.fromCharCode(...header);
            
            if (headerStr !== 'MThd') {
                // If it's not a MIDI file (e.g., HTML error page), decode text for debugging
                const decoder = new TextDecoder();
                const preview = decoder.decode(this.rawMidiBuffer.slice(0, 200));
                console.error('Invalid MIDI Header. Expected "MThd", got:', headerStr);
                console.error('Content preview:', preview);
                throw new Error(`Bad MIDI file. Expected 'MThd', got: '${headerStr}'. Content preview: ${preview.substring(0, 50)}...`);
            }

            this.applyTimeOffset(timeOffset);
            console.log(`MIDI loaded and shifted by ${timeOffset}s:`, this.midiData);
            return true;
        } catch (error) {
            console.error('Error loading MIDI:', error);
            alert('Error loading MIDI: ' + error.message);
            this.rawMidiBuffer = null; // Clear on error
            return false;
        }
    }

    applyTimeOffset(timeOffset) {
        if (!this.rawMidiBuffer) return false;

        // Re-create from the raw buffer to get clean, unmodified note times
        this.midiData = new Midi(this.rawMidiBuffer);

        // Shift all notes if a positive offset is provided
        if (timeOffset > 0) {
            this.midiData.tracks.forEach(track => {
                track.notes.forEach(note => {
                    note.time += timeOffset;
                });
            });
        }
        return true;
    }
    
    getAllNotes(activeTrackIndices) {
        if (!this.midiData) return [];
        
        const allNotes = [];
        this.midiData.tracks.forEach((track, index) => {
             if (activeTrackIndices === undefined || activeTrackIndices.has(index)) {
                track.notes.forEach(note => {
                    allNotes.push({
                        name: note.name,
                        time: note.time,
                        duration: note.duration,
                        velocity: note.velocity,
                        track: index
                    });
                });
            }
        });
        
        return allNotes.sort((a, b) => a.time - b.time);
    }
    
    getDuration() {
        return this.midiData ? this.midiData.duration : 0;
    }

    getTrackInfo() {
        if (!this.midiData) return [];
        return this.midiData.tracks.map((track, index) => ({
            index: index,
            name: track.name.trim() || `Track ${index + 1}`,
            instrument: track.instrument.name
        }));
    }
}