chrome.action.onClicked.addListener(() => {
	if (chrome.runtime.openOptionsPage) {
		chrome.runtime.openOptionsPage();
	}
});
