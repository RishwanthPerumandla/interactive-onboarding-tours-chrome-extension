let isRecording = false;
let currentTab = 'tour'; // Track current tab
let allSavedTours = {}; // Store all fetched tours for filtering
let isRecordingPaused = false; // Track recording pause state
let recordedTourSteps = null; // Temporarily store steps after stopping
let recordedTourName = null; // Temporarily store tour name
let recordedApplicationName = null; // Temporarily store application name

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
});

document.querySelector('.search-btn').addEventListener('click', function() {
  alert('Search clicked!');
});

const recordBtn = document.querySelector('.record-btn');
const pauseBtn = document.querySelector('.pause-btn');
const confirmationArea = document.querySelector('.recording-confirmation');
const saveTourBtn = document.querySelector('.save-tour-btn');
const discardTourBtn = document.querySelector('.discard-tour-btn');

recordBtn.addEventListener('click', async function() {
    console.log('Record button clicked, current tab:', currentTab);
    
    // Only allow recording in the Tours tab
    if (currentTab !== 'tour') {
        alert('Please switch to the Tours tab to record a new tour.');
        return;
    }

    if (!isRecording) {
        console.log('Attempting to start recording...');
        // Ensure confirmation area is hidden when starting new recording
        confirmationArea.style.display = 'none';
        recordedTourSteps = null;
        recordedTourName = null;
        recordedApplicationName = null;
        
        // Start recording
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Current tab:', tab);
        
        chrome.tabs.sendMessage(tab.id, { action: 'startRecording' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Could not send startRecording message:', chrome.runtime.lastError.message);
                // Assume content script is not available or has issues
                alert('Could not start recording. Please ensure the page is fully loaded and try again.');
                isRecording = false; // Reset state if sending fails
                recordBtn.textContent = 'Record New Tour';
                recordBtn.classList.remove('recording');
                pauseBtn.style.display = 'none'; // Hide pause button
                confirmationArea.style.display = 'none';
                return;
            }
            console.log('Received response from content script:', response);
            if (response && response.status === 'Recording started') {
                isRecording = true;
                isRecordingPaused = false; // Ensure pause is false on start
                recordBtn.textContent = 'Stop Recording';
                recordBtn.classList.add('recording');
                pauseBtn.style.display = ''; // Show pause button
                pauseBtn.textContent = 'Pause Recording'; // Reset pause button text
                confirmationArea.style.display = 'none';
                console.log('Record button text updated to:', recordBtn.textContent);
                console.log('Recording started successfully');
            } else {
                console.error('Failed to start recording with unexpected response:', response);
                alert('Recording did not start. Received unexpected response.');
                isRecording = false; // Reset state if response is bad
                recordBtn.textContent = 'Record New Tour';
                recordBtn.classList.remove('recording');
                pauseBtn.style.display = 'none'; // Hide pause button
                confirmationArea.style.display = 'none';
            }
        });
    } else {
        console.log('Attempting to stop recording...');
        // Stop recording

        // If currently paused, unpause before stopping
        if (isRecordingPaused) {
            // We don't need to send an unpause message here, just update state locally
            isRecordingPaused = false;
            pauseBtn.textContent = 'Pause Recording';
            console.log('Recording was paused, unpausing before stopping.');
        }

        const tourNameInput = document.getElementById('tour-name-input');
        const tourName = tourNameInput ? tourNameInput.value.trim() : '';
        
        if (!tourName) {
            alert('Please enter a name for your tour.');
            return; // Don't stop recording if no name is provided
        }

        const applicationElement = document.querySelector('#page-tour .section-content');
        const applicationName = applicationElement ? applicationElement.textContent.trim() : 'Unknown Application';
        console.log('Stopping recording for tour:', tourName, 'in application:', applicationName);

        // Store tour name and application name temporarily
        recordedTourName = tourName;
        recordedApplicationName = applicationName;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'stopRecording', tourName: tourName, applicationName: applicationName }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Could not send stopRecording message:', chrome.runtime.lastError.message);
                // Assume content script is not available or has issues
                // Don't alert here, might be expected if page closed.
                isRecording = false; // Reset state anyway
                recordBtn.textContent = 'Record New Tour';
                recordBtn.classList.remove('recording');
                pauseBtn.style.display = 'none'; // Hide pause button
                confirmationArea.style.display = '';
                return;
            }
            console.log('Received response from content script:', response);
            if (response && response.status === 'Recording stopped' && response.steps) {
                isRecording = false;
                isRecordingPaused = false; // Ensure pause is false on stop
                recordBtn.textContent = 'Record New Tour';
                recordBtn.classList.remove('recording');
                pauseBtn.style.display = 'none'; // Hide pause button
                console.log('Record button text updated to:', recordBtn.textContent);
                console.log('Recorded steps:', response.steps);
                
                // Store recorded steps and show confirmation
                recordedTourSteps = response.steps;
                confirmationArea.style.display = ''; // Show confirmation area

            } else {
                console.error('Failed to stop recording with unexpected response:', response);
                alert('Recording did not stop correctly. Received unexpected response.');
                 isRecording = false; // Reset state anyway
                recordBtn.textContent = 'Record New Tour';
                recordBtn.classList.remove('recording');
                pauseBtn.style.display = 'none'; // Hide pause button
                confirmationArea.style.display = '';
            }
        });
    }
});

document.querySelector('.play-btn').addEventListener('click', async function() {
    console.log('Play button clicked, current tab:', currentTab);

    // Only allow playing in the Tours tab
    if (currentTab !== 'tour') {
        alert('Please switch to the Tours tab to play a tour.');
        return;
    }

    const dropdown = document.querySelector('.dropdown');
    const selectedTourName = dropdown ? dropdown.value : '';

    if (!selectedTourName) {
        alert('Please select a tour to play.');
        return; // Don't proceed if no tour is selected
    }

    // Send message to content script to start replay for the selected tour
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Attempting to send replayTour message for tour:', selectedTourName, 'to tab:', tab);

    chrome.scripting.executeScript({
  target: { tabId: tab.id, allFrames: true },
  files: ['content.js']
}, () => {
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['content.js']
}, () => {
 chrome.tabs.sendMessage(tab.id, { action: 'replayTour', tourName: selectedTourName }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Replay failed after reinjection:', chrome.runtime.lastError.message);
      alert('Replay failed. Try reloading the page and ensure the site is supported.');
      return;
    }
    console.log('✅ Replay started:', response);
  });
});

});
}); 

document.querySelector('.settings-icon').addEventListener('click', function() {
  alert('Settings clicked!');
});

function showPage(pageId) {
  document.getElementById('page-tour').style.display = 'none';
  document.getElementById('page-view').style.display = 'none';
  document.getElementById('page-observer').style.display = 'none';
  document.getElementById(pageId).style.display = '';
  
  // Update current tab
  currentTab = pageId.replace('page-', '');
  
  // If switching away from tour tab while recording, stop recording
  if (currentTab !== 'tour' && isRecording) {
    const recordBtn = document.querySelector('.record-btn');
    const pauseBtn = document.querySelector('.pause-btn');
    recordBtn.click(); // This will trigger the stop recording logic
    // Ensure pause button is hidden when stopping recording due to tab switch
    pauseBtn.style.display = 'none';
  }
}

function setActiveTab(tabId) {
  document.getElementById('tab-tour').classList.remove('active');
  document.getElementById('tab-view').classList.remove('active');
  document.getElementById('tab-observer').classList.remove('active');
  document.getElementById(tabId).classList.add('active');
}

document.getElementById('tab-tour').addEventListener('click', function() {
  showPage('page-tour');
  setActiveTab('tab-tour');
  // Show pause button if currently recording (and not paused) when switching back to Tour tab
  if (isRecording && !isRecordingPaused) {
      pauseBtn.style.display = '';
  }
});

document.getElementById('tab-view').addEventListener('click', function() {
  showPage('page-view');
  setActiveTab('tab-view');
  // When View tab is clicked, fetch and display tours
  fetchAndDisplayTours();
  // Hide pause button when switching away from Tour tab
  pauseBtn.style.display = 'none';
});

document.getElementById('tab-observer').addEventListener('click', function() {
  showPage('page-observer');
  setActiveTab('tab-observer');
  // Hide pause button when switching away from Tour tab
  pauseBtn.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', async () => {
    // Request recording state from content script when popup opens
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'getRecordingState' }, (response) => {
            if (chrome.runtime.lastError) {
                // This is expected if the content script is not injected (e.g. on a Chrome internal page)
                console.info('Could not get recording state from content script:', chrome.runtime.lastError.message);
                isRecording = false;
                isRecordingPaused = false; // Assume not paused if connection fails
                updateRecordButtonUI(); // Update button based on initial false state
                return;
            }
            console.log('Received recording state from content script:', response);
            if (response && typeof response.isRecording !== 'undefined') {
                isRecording = response.isRecording;
                // Also get the pause state on load
                chrome.tabs.sendMessage(tab.id, { action: 'getRecordingPauseState' }, (pauseResponse) => {
                     if (chrome.runtime.lastError) {
                         console.warn('Could not get recording pause state from content script:', chrome.runtime.lastError.message);
                         isRecordingPaused = false; // Assume not paused if connection fails
                     } else if (pauseResponse && typeof pauseResponse.isPaused !== 'undefined') {
                         isRecordingPaused = pauseResponse.isPaused;
                         console.log('Received recording pause state:', isRecordingPaused);
                     } else {
                          isRecordingPaused = false; // Default to not paused
                     }
                     updateRecordButtonUI(); // Update button based on both recording and pause states
                });
            }
        });

        // Request saved tour names from content script
        chrome.tabs.sendMessage(tab.id, { action: 'getTourNames' }, (response) => {
            if (chrome.runtime.lastError) {
                // This is expected if the content script is not injected
                console.info('Could not get tour names from content script:', chrome.runtime.lastError.message);
                return;
            }
            console.log('Received tour names from content script:', response);
            if (response && response.tourNames) {
                populateTourDropdown(response.tourNames);
            }
        });

    } else {
        console.warn('Could not get active tab to request state and tour names.');
         isRecording = false; // Assume not recording if no active tab
         isRecordingPaused = false; // Assume not paused if no active tab
         updateRecordButtonUI(); // Update button based on initial false state
    }

    // Move play button event listener inside DOMContentLoaded
    document.querySelector('.play-btn').addEventListener('click', async function() {
        console.log('Play button clicked, current tab:', currentTab);

        // Only allow playing in the Tours tab
        if (currentTab !== 'tour') {
            alert('Please switch to the Tours tab to play a tour.');
            return;
        }

        const dropdown = document.querySelector('.dropdown');
        const selectedTourName = dropdown ? dropdown.value : '';

        if (!selectedTourName) {
            alert('Please select a tour to play.');
            return; // Don't proceed if no tour is selected
        }

        // Send message to content script to start replay for the selected tour
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Attempting to send replayTour message for tour:', selectedTourName, 'to tab:', tab);

     chrome.tabs.sendMessage(tab.id, { action: 'replayTour', tourName: selectedTourName }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Replay failed after reinjection:', chrome.runtime.lastError.message);
      alert('Replay failed. Try reloading the page and ensure the site is supported.');
      return;
    }
    console.log('✅ Replay started:', response);
  });
    });
});

// Function to populate the tour dropdown
function populateTourDropdown(tourNames) {
    const dropdown = document.querySelector('.dropdown');
    if (!dropdown) return;

    // Clear existing options except the default
    dropdown.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a Tour --';
    dropdown.appendChild(defaultOption);

    // Add saved tour names as options
    tourNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        dropdown.appendChild(option);
    });
}

// Function to update the record button's text and class based on the isRecording state
function updateRecordButtonUI() {
     const recordBtn = document.querySelector('.record-btn');
     const pauseBtn = document.querySelector('.pause-btn');
     const confirmationArea = document.querySelector('.recording-confirmation');
     if (recordBtn) {
         if (isRecording) {
             recordBtn.textContent = 'Stop Recording';
             recordBtn.classList.add('recording');
             
             // Update pause button visibility and state class
             pauseBtn.style.display = '';
             if (isRecordingPaused) {
                 pauseBtn.textContent = 'Resume Recording';
                 pauseBtn.classList.add('paused');
             } else {
                 pauseBtn.textContent = 'Pause Recording';
                 pauseBtn.classList.remove('paused');
             }
              console.log('Popup UI updated: Showing Stop Recording');
         } else {
             recordBtn.textContent = 'RECORD NEW TOUR';
             recordBtn.classList.remove('recording');
             
             // Hide pause button and remove paused class when not recording
             pauseBtn.style.display = 'none';
             pauseBtn.classList.remove('paused');
              console.log('Popup UI updated: Showing Record New Tour');
         }
     }
}

// Call updateRecordButtonUI initially when the script loads (before receiving state)
updateRecordButtonUI();

// Function to fetch and display all tours in the table
async function fetchAndDisplayTours() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'getAllTours' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Error fetching all tours:', chrome.runtime.lastError.message);
                // Assume content script is not available or has issues
                return;
            }
            console.log('Received all tours:', response);
            if (response && response.savedTours) {
                allSavedTours = response.savedTours; // Store the full list
                populateToursTable(allSavedTours); // Populate initially with all tours
            }
        });
    }
}

// Function to populate the tours table
function populateToursTable(savedToursToDisplay) {
    const tableBody = document.querySelector('.tours-table tbody');
    if (!tableBody) return;

    // Clear existing rows
    tableBody.innerHTML = '';

    // Add a row for each saved tour
    for (const tourName in savedToursToDisplay) {
        if (Object.hasOwnProperty.call(savedToursToDisplay, tourName)) {
            const tourData = savedToursToDisplay[tourName];
            const row = tableBody.insertRow();
            
            const nameCell = row.insertCell(0);
            nameCell.textContent = tourName;
            
            const appCell = row.insertCell(1);
            appCell.textContent = tourData.application || 'N/A'; // Use saved application name
            
            // Add Action buttons cell
            const actionsCell = row.insertCell(2);
            actionsCell.style.width = '120px'; // Adjust width as needed
            actionsCell.style.textAlign = 'center';

            // Edit Button
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.style.cssText = 'margin-right: 5px; padding: 3px 8px; cursor: pointer; background-color: #2196F3; color: white; border: none; border-radius: 3px;'; // Improved styling
            editButton.addEventListener('click', () => {
                console.log('Edit button clicked for tour:', tourName);
                // For now, just show an alert that editing is coming soon
                alert('Tour editing functionality will be available in the next update!');
            });
            actionsCell.appendChild(editButton);

            // Delete Button
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.style.cssText = 'padding: 3px 8px; cursor: pointer; background-color: #f44336; color: white; border: none; border-radius: 3px;'; // Basic styling
            deleteButton.addEventListener('click', () => {
                console.log('Delete button clicked for tour:', tourName);
                // Call a function to delete this tour
                if (confirm(`Are you sure you want to delete the tour '${tourName}'?`)) {
                    deleteTour(tourName);
                }
            });
            actionsCell.appendChild(deleteButton);
        }
    }
}

// Function to trigger tour replay from the table
async function playTourFromTable(tourName) {
     // This is similar to the play button in the Tour tab, but uses the provided tourName
     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
     if (tab && tab.id) {
         console.log('Attempting to send replayTour message for tour:', tourName, 'to tab:', tab);

         chrome.tabs.sendMessage(tab.id, { action: 'replayTour', tourName: tourName }, (response) => {
             if (chrome.runtime.lastError) {
                 console.warn('Error sending replayTour message from table:', chrome.runtime.lastError.message);
                 // Assume content script is not available or has issues
                 alert('Could not start tour replay. Please ensure the page is fully loaded and try again.');
                 return;
             }
             console.log('Received response from content script for replayTour from table:', response);
             // Content script will handle the replay UI
         });
     }
}

// Function to delete a tour
async function deleteTour(tourName) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
        console.log('Attempting to send deleteTour message for tour:', tourName);

        chrome.tabs.sendMessage(tab.id, { action: 'deleteTour', tourName: tourName }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Error sending deleteTour message:', chrome.runtime.lastError.message);
                // Assume content script is not available or has issues
                alert('Could not delete tour.');
                return;
            }
            console.log('Received response from content script for deleteTour:', response);
            if (response && response.status === 'Tour deleted') {
                console.log('Tour deleted successfully, refreshing table.');
                // Refresh the table display after deletion
                fetchAndDisplayTours();
                 // Also refresh the dropdown in the Tour tab
                 fetchAndPopulateTourDropdown(); // Need to create this function or reuse logic
            } else {
                 console.error('Delete tour failed with unexpected response:', response);
                 alert('Failed to delete tour.');
            }
        });
    }
}

// Need a function to refresh the tour dropdown in the Tour tab after deletion
async function fetchAndPopulateTourDropdown() {
     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
     if (tab && tab.id) {
         chrome.tabs.sendMessage(tab.id, { action: 'getTourNames' }, (response) => {
             if (chrome.runtime.lastError) {
                 // This is expected if the content script is not injected
                 console.info('Could not get tour names from content script after deletion:', chrome.runtime.lastError.message);
                 return;
             }
             console.log('Received updated tour names for dropdown:', response);
             if (response && response.tourNames) {
                 populateTourDropdown(response.tourNames);
             }
         });
     }
}

// Add event listener to the filter input field
const filterInput = document.querySelector('.view-search-bar input');
if (filterInput) {
    filterInput.addEventListener('input', () => {
        const filterText = filterInput.value.toLowerCase();
        const filteredTours = {};

        // Filter the stored tours based on the input text
        for (const tourName in allSavedTours) {
            if (Object.hasOwnProperty.call(allSavedTours, tourName)) {
                if (tourName.toLowerCase().includes(filterText)) {
                    filteredTours[tourName] = allSavedTours[tourName];
                }
            }
        }
        // Repopulate the table with the filtered tours
        populateToursTable(filteredTours);
    });
}

// Add event listener for the pause/unpause button
pauseBtn.addEventListener('click', async function() {
    console.log('Pause/Unpause button clicked. Current state:', isRecordingPaused);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
        console.error('Could not get active tab to send pause/unpause message.');
        return;
    }

    if (!isRecordingPaused) {
        // Currently recording, pause it
        console.log('Attempting to pause recording...');
        chrome.tabs.sendMessage(tab.id, { action: 'pauseRecording' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Could not send pauseRecording message:', chrome.runtime.lastError.message);
                // Assume content script is not available or has issues
                return;
            }
            console.log('Received response for pauseRecording:', response);
            if (response && response.status === 'Recording paused') {
                isRecordingPaused = true;
                pauseBtn.textContent = 'Resume Recording';
                pauseBtn.classList.add('paused');
                console.log('Recording paused.');
            }
        });
    } else {
        // Currently paused, resume recording
        console.log('Attempting to resume recording...');
        chrome.tabs.sendMessage(tab.id, { action: 'resumeRecording' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Could not send resumeRecording message:', chrome.runtime.lastError.message);
                // Assume content script is not available or has issues
                return;
            }
            console.log('Received response for resumeRecording:', response);
            if (response && response.status === 'Recording resumed') {
                isRecordingPaused = false;
                pauseBtn.textContent = 'Pause Recording';
                pauseBtn.classList.remove('paused');
                console.log('Recording resumed.');
            }
        });
    }
});

// Add event listener for Save Tour button
saveTourBtn.addEventListener('click', async function() {
    console.log('Save Tour button clicked.');

    if (!recordedTourSteps || recordedTourSteps.length === 0) {
    chrome.storage.local.get(['recordedSteps', 'recordedTourMeta'], (res) => {
        recordedTourSteps = res.recordedSteps || [];

        // Also restore name and app
        if (res.recordedTourMeta) {
            recordedTourName = res.recordedTourMeta.tourName || '';
            recordedApplicationName = res.recordedTourMeta.appName || '';
        }

        if (recordedTourSteps.length === 0) {
            alert('No recorded steps found. Please try recording again.');
            confirmationArea.style.display = 'none';
            return;
        }

        console.log('✅ Restored steps from chrome.storage. Retrying save.');
        saveTourBtn.click(); // re-trigger save now that steps are loaded
    });
    return;
}


    if (recordedTourSteps && recordedTourName && recordedApplicationName) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
             // Send message to content script to save the tour with temporary data
             chrome.tabs.sendMessage(tab.id, { 
                 action: 'saveRecordedTour',
                 tourName: recordedTourName,
                 applicationName: recordedApplicationName,
                 steps: recordedTourSteps
             }, (response) => {
                 if (chrome.runtime.lastError) {
                     console.error('Error sending saveRecordedTour message:', chrome.runtime.lastError.message);
                     alert('Could not save tour.');
                     return;
                 }
                 console.log('Received response for saveRecordedTour:', response);
                 if (response && response.status === 'Tour saved') {
                     console.log('Tour saved successfully.');
                     // Clear temporary data and hide confirmation area
                     recordedTourSteps = null;
                     recordedTourName = null;
                     recordedApplicationName = null;
                     confirmationArea.style.display = 'none';
                     // Optionally, refresh the tour dropdown and table
                     fetchAndPopulateTourDropdown();
                     fetchAndDisplayTours();
                 } else {
                      console.error('Save tour failed with unexpected response:', response);
                      alert('Failed to save tour.');
                 }
             });
        } else {
            console.error('Could not get active tab to send saveRecordedTour message.');
            alert('Could not save tour.');
        }
    } else {
        console.warn('No recorded tour data available to save.');
        // Hide confirmation area if no data somehow
        confirmationArea.style.display = 'none';
    }
});

// Add event listener for Discard button
discardTourBtn.addEventListener('click', function() {
    console.log('Discard button clicked.');
    // Clear temporary data and hide confirmation area
    recordedTourSteps = null;
    recordedTourName = null;
    recordedApplicationName = null;
    confirmationArea.style.display = 'none';
    console.log('Recorded tour discarded.');
});
