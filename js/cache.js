'use strict';

function saveItem(key, data) {
	try {
		return localStorage.setItem(key, data);
	} catch (ignore) {
		console.log(ignore);
	}
};

function getItem(key) {
	try {
		return localStorage.getItem(key);
	} catch (ignore) {
		console.log(ignore);
	}
};

function clearCache() {
	try {
		localStorage && localStorage.clear();
	} catch (ignore) {
		console.log(ignore);
	}
};