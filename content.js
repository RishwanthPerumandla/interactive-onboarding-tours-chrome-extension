console.log('✅ Content script loaded');

class TourManager {
    constructor() {
        this.isRecording = false;
        this.tourSteps = [];
        this._addClickListeners();

        chrome.storage.local.get(['resumeReplay', 'savedTours'], (res) => {
            const { resumeReplay, savedTours } = res;
            if (!resumeReplay || !resumeReplay.tourName) return;

            const { tourName, stepIndex } = resumeReplay;
            const tour = savedTours?.[tourName];
            if (!tour || !tour.steps || stepIndex >= tour.steps.length) return;

            console.log(`⏯️ Preparing to resume tour '${tourName}' from step ${stepIndex}`);
            chrome.storage.local.remove('resumeReplay');
            const resume = () => this._showStepWithControls(tour.steps, stepIndex, tourName);
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                resume();
            } else {
                window.addEventListener('DOMContentLoaded', resume);
            }
        });

        chrome.storage.local.get(['recordingState', 'recordedSteps'], (res) => {
            if (res.recordingState) {
                this.isRecording = true;
                this.tourSteps = res.recordedSteps || [];
                this._showRecordingIndicator();
                console.log('🔁 Recording restored. Existing steps:', this.tourSteps);
            }
        });
    }

    startRecording() {
        this.isRecording = true;
        this.tourSteps = [];
        chrome.storage.local.set({
            recordingState: true,
            recordedSteps: []
        });
        this._showRecordingIndicator();
        console.log('🔴 Recording started');
        return { status: 'Recording started' };
    }

    stopRecording(tourName, appName, sendResponse) {
        this.isRecording = false;
        this._hideRecordingIndicator();
        const recordedSteps = [...this.tourSteps];
        this.tourSteps = [];

        chrome.storage.local.set({
            recordingState: false,
            recordedSteps: recordedSteps,
            recordedTourMeta: { tourName, appName }
        }, () => {
            console.log('🛑 Recording stopped. Steps:', recordedSteps);
            sendResponse({ status: 'Recording stopped', steps: recordedSteps });
        });

        return true;
    }

    _addClickListeners() {
        document.addEventListener('click', (event) => {
            if (!this.isRecording) return;
            const el = event.target;
            const selector = this._getSelector(el);
            if (!selector) return;

            let shouldNavigate = false;
            let href = '';
            if (el.tagName === 'A' && el.getAttribute('href')) {
                event.preventDefault();
                shouldNavigate = true;
                href = el.href;
            }

            const tooltip = prompt('Enter tooltip:');
            if (tooltip === null) return;

            const step = {
                selector,
                action: 'click',
                tooltip,
                url: window.location.href
            };

            this.tourSteps.push(step);
            chrome.storage.local.set({ recordedSteps: this.tourSteps }, () => {
                console.log('✅ Step recorded and stored:', step);
            });

            if (shouldNavigate && href) {
                setTimeout(() => {
                    window.location.href = href;
                }, 300);
            }
        }, true);
    }

    _getSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.tagName === 'A' && el.classList.length > 0 && el.getAttribute('href')) {
            return `a.${Array.from(el.classList).join('.')}[href="${el.getAttribute('href')}"]`;
        }
        if (el.classList.length > 0) {
            return '.' + Array.from(el.classList).join('.');
        }
        return el.tagName.toLowerCase();
    }

    _showRecordingIndicator() {
        if (!document.getElementById('recording-indicator')) {
            const banner = document.createElement('div');
            banner.id = 'recording-indicator';
            banner.textContent = 'RECORDING...';
            banner.style.cssText = `
                position: fixed; top: 10px; right: 10px;
                background: red; color: white;
                padding: 6px 12px; font-weight: bold;
                border-radius: 4px; z-index: 9999;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(banner);
        }
    }

    _hideRecordingIndicator() {
        const banner = document.getElementById('recording-indicator');
        if (banner) banner.remove();
    }

    saveTour(tourName, applicationName, steps, sendResponse) {
        const enriched = steps.map((step, i) => ({ ...step, tourName, stepNumber: i + 1 }));
        chrome.storage.local.get(['savedTours'], (res) => {
            const saved = res.savedTours || {};
            saved[tourName] = { application: applicationName, steps: enriched };
            chrome.storage.local.set({ savedTours: saved }, () => {
                console.log(`💾 Tour '${tourName}' saved with ${enriched.length} steps.`);
                sendResponse({ status: 'Tour saved' });
            });
        });
    }

    replayTour(tourName) {
        chrome.storage.local.get(['savedTours'], (res) => {
            const tour = res.savedTours?.[tourName];
            if (!tour?.steps?.length) {
                alert('⚠️ No recorded steps found.');
                return;
            }
            this._showStepWithControls(tour.steps, 0, tourName);
        });
    }

    _showStepWithControls(steps, stepIndex, tourName) {
        if (stepIndex >= steps.length) {
            console.log('✅ Tour completed.');
            return;
        }

        const step = steps[stepIndex];
        const norm = url => new URL(url).origin + new URL(url).pathname;

        if (norm(step.url) !== norm(window.location.href)) {
            chrome.storage.local.set(
                { resumeReplay: { tourName, stepIndex } },
                () => window.location.href = step.url
            );
            return;
        }

        const clearUI = () => {
            document.querySelectorAll('.tour-multi-overlay').forEach(o => o.remove());
            document.querySelector('.tour-tooltip')?.remove();
            document.querySelector('.tour-highlight')?.classList.remove('tour-highlight');
        };

        this.waitForElement(step.selector).then(el => {
            clearUI();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const rect = el.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            const overlays = [
                { top: 0, left: 0, width: '100vw', height: `${rect.top + scrollY}px` },
                { top: `${rect.bottom + scrollY}px`, left: 0, width: '100vw', height: `${winH - rect.bottom - scrollY}px` },
                { top: `${rect.top + scrollY}px`, left: 0, width: `${rect.left + scrollX}px`, height: `${rect.height}px` },
                { top: `${rect.top + scrollY}px`, left: `${rect.right + scrollX}px`, width: `${winW - rect.right - scrollX}px`, height: `${rect.height}px` }
            ];

            overlays.forEach(({ top, left, width, height }) => {
                const overlay = document.createElement('div');
                overlay.className = 'tour-multi-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: ${top};
                    left: ${left};
                    width: ${width};
                    height: ${height};
                    background: rgba(0, 0, 0, 0.6);
                    z-index: 9998;
                    pointer-events: auto;
                `;
                document.body.appendChild(overlay);
            });

            el.classList.add('tour-highlight');
            el.style.position = 'relative';
            el.style.zIndex = '10000';
            el.style.boxShadow = '0 0 0 3px #00ff88, 0 0 12px #00ff88';

            const tooltip = document.createElement('div');
            tooltip.className = 'tour-tooltip';
            tooltip.innerHTML = `
                <div style="background: #333; color: #fff; padding: 10px 14px; border-radius: 6px; font-weight: 500; font-family: sans-serif; font-size: 14px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                    ${step.tooltip || 'Click here to continue'}
                </div>`;

            Object.assign(tooltip.style, {
                position: 'absolute',
                top: `${rect.bottom + window.scrollY + 12}px`,
                left: `${rect.left + window.scrollX}px`,
                zIndex: '10001'
            });

            document.body.appendChild(tooltip);

            el.addEventListener('click', () => {
                clearUI();
                if (stepIndex < steps.length - 1) {
                    this._showStepWithControls(steps, stepIndex + 1, tourName);
                }
            }, { once: true });
        });
    }

    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                }
            }, 200);
            setTimeout(() => {
                clearInterval(interval);
                reject(new Error('Element not found: ' + selector));
            }, timeout);
        });
    }
}

const manager = new TourManager();

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch (req.action) {
        case 'startRecording':
            sendResponse(manager.startRecording());
            return true;
        case 'stopRecording':
            return manager.stopRecording(req.tourName, req.applicationName, sendResponse);
        case 'saveRecordedTour':
            manager.saveTour(req.tourName, req.applicationName, req.steps, sendResponse);
            return true;
        case 'getTourNames':
            chrome.storage.local.get(['savedTours'], res => {
                sendResponse({ tourNames: Object.keys(res.savedTours || {}) });
            });
            return true;
        case 'getAllTours':
            chrome.storage.local.get(['savedTours'], res => {
                sendResponse({ savedTours: res.savedTours || {} });
            });
            return true;
        case 'getRecordingState':
            chrome.storage.local.get(['recordingState'], res => {
                sendResponse({ isRecording: res.recordingState || false });
            });
            return true;
        case 'replayTour':
            console.log("🎬 Starting replay for", req.tourName);
            manager.replayTour(req.tourName);
            sendResponse({ status: 'Replay started' });
            return true;
        case 'deleteTour':
            chrome.storage.local.get(['savedTours'], res => {
                const saved = res.savedTours || {};
                delete saved[req.tourName];
                chrome.storage.local.set({ savedTours: saved }, () => {
                    sendResponse({ status: 'Tour deleted' });
                });
            });
            return true;
    }
});