// ==UserScript==
// @id             iitc-plugin-guardians@3ch01c
// @name           IITC plugin: Guardians
// @category       Misc
// @version        0.2.3.20141206.72845
// @namespace      https://github.com/3ch01c/ingress-intel-total-conversion
// @updateURL      https://secure.jonatkins.com/iitc/test/plugins/guardians.meta.js
// @downloadURL    https://secure.jonatkins.com/iitc/test/plugins/guardians.user.js
// @description    [jonatkins-test-2014-12-06-072845] Allow manual entry of portals visited/captured. Use the 'highlighter-guardians' plugin to show the guardians on the map, and 'sync' to share between multiple browsers or desktop/mobile. It will try and guess which portals you have captured from COMM/portal details, but this will not catch every case.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'jonatkins-test';
plugin_info.dateTimeVersion = '20141206.72845';
plugin_info.pluginId = 'guardians';
//END PLUGIN AUTHORS NOTE


//PLUGIN START ////////////////////////////////////////////////////////

//use own namespace for plugin
window.plugin.guardians = function() {};

//delay in ms
window.plugin.guardians.SYNC_DELAY = 5000;

// maps the JS property names to localStorage keys
window.plugin.guardians.FIELDS = {
	'guardians': 'plugin-guardians-data',
	'updateQueue': 'plugin-guardians-data-queue',
	'updatingQueue': 'plugin-guardians-data-updating-queue',
};

window.plugin.guardians.guardians = {};
window.plugin.guardians.updateQueue = {};
window.plugin.guardians.updatingQueue = {};

window.plugin.guardians.enableSync = false;

window.plugin.guardians.disabledMessage = null;
window.plugin.guardians.contentHTML = null;

window.plugin.guardians.isHighlightActive = false;

window.plugin.guardians.onPortalDetailsUpdated = function() {
	if(typeof(Storage) === "undefined") {
		$('#portaldetails > .imgpreview').after(plugin.guardians.disabledMessage);
		return;
	}

	var guid = window.selectedPortal,
		details = portalDetail.get(guid),
		nickname = window.PLAYER.nickname;
	if(details) {
		if(details.owner == nickname) {
			plugin.guardians.updateCaptured(true);
			// no further logic required
		} else {
			function installedByPlayer(entity) {
				return entity && entity.owner == nickname;
			}
			
			if(details.resonators.some(installedByPlayer) || details.mods.some(installedByPlayer)) {
				plugin.guardians.updateVisited(true);
			}
		}
	}

	$('#portaldetails > .imgpreview').after(plugin.guardians.contentHTML);
	plugin.guardians.updateCheckedAndHighlight(guid);
}

window.plugin.guardians.onPublicChatDataAvailable = function(data) {
	var nick = window.PLAYER.nickname;
	data.raw.success.forEach(function(msg) {
		var plext = msg[2].plext,
			markup = plext.markup;

		// search for "x deployed an Ly Resonator on z"
		if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==5
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' deployed an '
		&& markup[2][0] == 'TEXT'
		&& markup[3][0] == 'TEXT'
		&& markup[3][1].plain == ' Resonator on '
		&& markup[4][0] == 'PORTAL') {
			var portal = markup[4][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.guardians.setPortalVisited(guid);
		}

		// search for "x captured y"
		if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==3
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' captured '
		&& markup[2][0] == 'PORTAL') {
			var portal = markup[2][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.guardians.setPortalCaptured(guid);
		}

		// search for "x linked y to z"
		if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==5
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' linked '
		&& markup[2][0] == 'PORTAL'
		&& markup[3][0] == 'TEXT'
		&& markup[3][1].plain == ' to '
		&& markup[4][0] == 'PORTAL') {
			var portal = markup[2][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.guardians.setPortalVisited(guid);
		}

		// search for "Your Lx Resonator on y was destroyed by z"
		if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==6
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your '
		&& markup[1][0] == 'TEXT'
		&& markup[2][0] == 'TEXT'
		&& markup[2][1].plain == ' Resonator on '
		&& markup[3][0] == 'PORTAL'
		&& markup[4][0] == 'TEXT'
		&& markup[4][1].plain == ' was destroyed by '
		&& markup[5][0] == 'PLAYER') {
			var portal = markup[3][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.guardians.setPortalVisited(guid);
		}

		// search for "Your Lx Resonator on y has decayed"
		if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==5
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your '
		&& markup[1][0] == 'TEXT'
		&& markup[2][0] == 'TEXT'
		&& markup[2][1].plain == ' Resonator on '
		&& markup[3][0] == 'PORTAL'
		&& markup[4][0] == 'TEXT'
		&& markup[4][1].plain == ' has decayed') {
			var portal = markup[3][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.guardians.setPortalVisited(guid);
		}

		// search for "Your Portal x neutralized by y"
		// search for "Your Portal x is under attack by y"
		if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==4
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your Portal '
		&& markup[1][0] == 'PORTAL'
		&& markup[2][0] == 'TEXT'
		&& (markup[2][1].plain == ' neutralized by ' || markup[2][1].plain == ' is under attack by ')
		&& markup[3][0] == 'PLAYER') {
			var portal = markup[1][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.guardians.setPortalVisited(guid);
		}
	});
}

window.plugin.guardians.updateCheckedAndHighlight = function(guid) {
	runHooks('pluginGuardiansUpdateGuardians', { guid: guid });

	if (guid == window.selectedPortal) {

		var guardianInfo = plugin.guardians.guardians[guid],
			visited = (guardianInfo && guardianInfo.visited) || false,
			captured = (guardianInfo && guardianInfo.captured) || false;
		$('#visited').prop('checked', visited);
		$('#captured').prop('checked', captured);
	}

	if (window.plugin.guardians.isHighlightActive) {
		if (portals[guid]) {
			window.setMarkerStyle (portals[guid], guid == selectedPortal);
		}
	}
}


window.plugin.guardians.setPortalVisited = function(guid) {
	var guardianInfo = plugin.guardians.guardians[guid];
	if (guardianInfo) {
		guardianInfo.visited = true;
	} else {
		plugin.guardians.guardians[guid] = {
			visited: true,
			captured: false
		};
	}

	plugin.guardians.updateCheckedAndHighlight(guid);
	plugin.guardians.sync(guid);
}

window.plugin.guardians.setPortalCaptured = function(guid) {
	var guardianInfo = plugin.guardians.guardians[guid];
	if (guardianInfo) {
		guardianInfo.visited = true;
		guardianInfo.captured = true;
	} else {
		plugin.guardians.guardians[guid] = {
			visited: true,
			captured: true
		};
	}

	plugin.guardians.updateCheckedAndHighlight(guid);
	plugin.guardians.sync(guid);
}

window.plugin.guardians.updateVisited = function(visited, guid) {
	if(guid == undefined) guid = window.selectedPortal;

	var guardianInfo = plugin.guardians.guardians[guid];
	if (!guardianInfo) {
		plugin.guardians.guardians[guid] = guardianInfo = {
			visited: false,
			captured: false
		};
	}

	if (visited) {
		guardianInfo.visited = true;
	} else { // not visited --> not captured
		guardianInfo.visited = false;
		guardianInfo.captured = false;
	}

	plugin.guardians.updateCheckedAndHighlight(guid);
	plugin.guardians.sync(guid);
}

window.plugin.guardians.updateCaptured = function(captured, guid) {
	if(guid == undefined) guid = window.selectedPortal;

	var guardianInfo = plugin.guardians.guardians[guid];
	if (!guardianInfo) {
		plugin.guardians.guardians[guid] = guardianInfo = {
			visited: false,
			captured: false
		};
	}

	if (captured) { // captured --> visited
		guardianInfo.captured = true;
		guardianInfo.visited = true;
	} else {
		guardianInfo.captured = false;
	}

	plugin.guardians.updateCheckedAndHighlight(guid);
	plugin.guardians.sync(guid);
}

// stores the gived GUID for sync
plugin.guardians.sync = function(guid) {
	plugin.guardians.updatingQueue[guid] = true;
	plugin.guardians.storeLocal('guardians');
	plugin.guardians.storeLocal('updateQueue');
	plugin.guardians.syncQueue();
}

// sync the queue, but delay the actual sync to group a few updates in a single request
window.plugin.guardians.syncQueue = function() {
	if(!plugin.guardians.enableSync) return;
	
	clearTimeout(plugin.guardians.syncTimer);
	
	plugin.guardians.syncTimer = setTimeout(function() {
		plugin.guardians.syncTimer = null;

		$.extend(plugin.guardians.updatingQueue, plugin.guardians.updateQueue);
		plugin.guardians.updateQueue = {};
		plugin.guardians.storeLocal('updatingQueue');
		plugin.guardians.storeLocal('updateQueue');

		plugin.sync.updateMap('guardians', 'guardians', Object.keys(plugin.guardians.updatingQueue));
	}, plugin.guardians.SYNC_DELAY);
}

//Call after IITC and all plugin loaded
window.plugin.guardians.registerFieldForSyncing = function() {
	if(!window.plugin.sync) return;
	window.plugin.sync.registerMapForSync('guardians', 'guardians', window.plugin.guardians.syncCallback, window.plugin.guardians.syncInitialed);
}

//Call after local or remote change uploaded
window.plugin.guardians.syncCallback = function(pluginName, fieldName, e, fullUpdated) {
	if(fieldName === 'guardians') {
		plugin.guardians.storeLocal('guardians');
		// All data is replaced if other client update the data during this client
		// offline,
		// fire 'pluginGuardiansRefreshAll' to notify a full update
		if(fullUpdated) {
			// a full update - update the selected portal sidebar
			if (window.selectedPortal) {
				plugin.guardians.updateCheckedAndHighlight(window.selectedPortal);
			}
			// and also update all highlights, if needed
			if (window.plugin.guardians.isHighlightActive) {
				resetHighlightedPortals();
			}

			window.runHooks('pluginGuardiansRefreshAll');
			return;
		}

		if(!e) return;
		if(e.isLocal) {
			// Update pushed successfully, remove it from updatingQueue
			delete plugin.guardians.updatingQueue[e.property];
		} else {
			// Remote update
			delete plugin.guardians.updateQueue[e.property];
			plugin.guardians.storeLocal('updateQueue');
			plugin.guardians.updateCheckedAndHighlight(e.property);
			window.runHooks('pluginGuardiansUpdateGuardians', {guid: e.property});
		}
	}
}

//syncing of the field is initialed, upload all queued update
window.plugin.guardians.syncInitialed = function(pluginName, fieldName) {
	if(fieldName === 'guardians') {
		plugin.guardians.enableSync = true;
		if(Object.keys(plugin.guardians.updateQueue).length > 0) {
			plugin.guardians.syncQueue();
		}
	}
}

window.plugin.guardians.storeLocal = function(name) {
	var key = window.plugin.guardians.FIELDS[name];
	if(key === undefined) return;

	var value = plugin.guardians[name];

	if(typeof value !== 'undefined' && value !== null) {
		localStorage[key] = JSON.stringify(plugin.guardians[name]);
	} else {
		localStorage.removeItem(key);
	}
}

window.plugin.guardians.loadLocal = function(name) {
	var key = window.plugin.guardians.FIELDS[name];
	if(key === undefined) return;

	if(localStorage[key] !== undefined) {
		plugin.guardians[name] = JSON.parse(localStorage[key]);
	}
}

/***************************************************************************************************************************************************************/
/** HIGHLIGHTER ************************************************************************************************************************************************/
/***************************************************************************************************************************************************************/
window.plugin.guardians.highlighter = {
	highlight: function(data) {
		var guid = data.portal.options.ent[0];
		var guardianInfo = window.plugin.guardians.guardians[guid];

		var style = {};

		if (guardianInfo) {
			if (guardianInfo.captured) {
				// captured (and, implied, visited too) - no highlights

			} else if (guardianInfo.visited) {
				style.fillColor = 'yellow';
				style.fillOpacity = 0.6;
			} else {
				// we have an 'guardianInfo' entry for the portal, but it's not set visited or captured?
				// could be used to flag a portal you don't plan to visit, so use a less opaque red
				style.fillColor = 'red';
				style.fillOpacity = 0.5;
			}
		} else {
			// no visit data at all
			style.fillColor = 'red';
			style.fillOpacity = 0.7;
		}

		data.portal.setStyle(style);
	},

	setSelected: function(active) {
		window.plugin.guardians.isHighlightActive = active;
	}
}


window.plugin.guardians.setupCSS = function() {
	$("<style>")
	.prop("type", "text/css")
	.html("#guardians-container {\n  display: block;\n  text-align: center;\n  margin: 6px 3px 1px 3px;\n  padding: 0 4px;\n}\n#guardians-container label {\n  margin: 0 0.5em;\n}\n#guardians-container input {\n  vertical-align: middle;\n}\n\n.portal-list-guardians input[type=\'checkbox\'] {\n  padding: 0;\n  height: auto;\n  margin-top: -5px;\n  margin-bottom: -5px;\n}\n")
	.appendTo("head");
}

window.plugin.guardians.setupContent = function() {
	plugin.guardians.contentHTML = '<div id="guardians-container">'
		+ '<label><input type="checkbox" id="visited" onclick="window.plugin.guardians.updateVisited($(this).prop(\'checked\'))"> Visited</label>'
		+ '<label><input type="checkbox" id="captured" onclick="window.plugin.guardians.updateCaptured($(this).prop(\'checked\'))"> Captured</label>'
		+ '</div>';
	plugin.guardians.disabledMessage = '<div id="guardians-container" class="help" title="Your browser does not support localStorage">Plugin Guardians disabled</div>';
}

window.plugin.guardians.setupPortalsList = function() {
	if(!window.plugin.portalslist) return;

	window.addHook('pluginGuardiansUpdateGuardians', function(data) {
		var info = plugin.guardians.guardians[data.guid];
		if(!info) info = { visited: false, captured: false };

		$('[data-list-guardians="'+data.guid+'"].visited').prop('checked', !!info.visited);
		$('[data-list-guardians="'+data.guid+'"].captured').prop('checked', !!info.captured);
	});

	window.addHook('pluginGuardiansRefreshAll', function() {
		$('[data-list-guardians]').each(function(i, element) {
			var guid = element.getAttribute("data-list-guardians");

			var info = plugin.guardians.guardians[guid];
			if(!info) info = { visited: false, captured: false };

			var e = $(element);
			if(e.hasClass('visited')) e.prop('checked', !!info.visited);
			if(e.hasClass('captured')) e.prop('checked', !!info.captured);
		});
	});

	function guardianValue(guid) {
		var info = plugin.guardians.guardians[guid];
		if(!info) return 0;

		if(info.visited && info.captured) return 2;
		if(info.visited) return 1;
	}

	window.plugin.portalslist.fields.push({
		title: "Visit",
		value: function(portal) { return portal.options.guid; }, // we store the guid, but implement a custom comparator so the list does sort properly without closing and reopening the dialog
		sort: function(guidA, guidB) {
			return guardianValue(guidA) - guardianValue(guidB);
		},
		format: function(cell, portal, guid) {
			var info = plugin.guardians.guardians[guid];
			if(!info) info = { visited: false, captured: false };

			$(cell).addClass("portal-list-guardians");

			// for some reason, jQuery removes event listeners when the list is sorted. Therefore we use DOM's addEventListener
			$('<input>')
				.prop({
					type: "checkbox",
					className: "visited",
					title: "Portal visited?",
					checked: !!info.visited,
				})
				.attr("data-list-guardians", guid)
				.appendTo(cell)
				[0].addEventListener("change", function(ev) {
					window.plugin.guardians.updateVisited(this.checked, guid);
					ev.preventDefault();
					return false;
				}, false);
			$('<input>')
				.prop({
					type: "checkbox",
					className: "captured",
					title: "Portal captured?",
					checked: !!info.captured,
				})
				.attr("data-list-guardians", guid)
				.appendTo(cell)
				[0].addEventListener("change", function(ev) {
					window.plugin.guardians.updateCaptured(this.checked, guid);
					ev.preventDefault();
					return false;
				}, false);
		},
	});
}

var setup = function() {
	if($.inArray('pluginGuardiansUpdateGuardians', window.VALID_HOOKS) < 0)
		window.VALID_HOOKS.push('pluginGuardiansUpdateGuardians');
	if($.inArray('pluginGuardiansRefreshAll', window.VALID_HOOKS) < 0)
		window.VALID_HOOKS.push('pluginGuardiansRefreshAll');
	window.plugin.guardians.setupCSS();
	window.plugin.guardians.setupContent();
	window.plugin.guardians.loadLocal('guardians');
	window.addHook('portalDetailsUpdated', window.plugin.guardians.onPortalDetailsUpdated);
	window.addHook('publicChatDataAvailable', window.plugin.guardians.onPublicChatDataAvailable);
	window.addHook('iitcLoaded', window.plugin.guardians.registerFieldForSyncing);
		window.addPortalHighlighter('Guardians', window.plugin.guardians.highlighter);

	if(window.plugin.portalslist) {
		window.plugin.guardians.setupPortalsList();
	} else {
		setTimeout(function() {
			if(window.plugin.portalslist)
				window.plugin.guardians.setupPortalsList();
		}, 500);
	}
}

//PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);

