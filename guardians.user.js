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
    if(typeof window.plugin !== 'function') {
        window.plugin = function() {};
    }

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
//plugin_info.buildName = 'jonatkins-test';
//plugin_info.dateTimeVersion = '20141206.72845';
//plugin_info.pluginId = 'guardians';
//END PLUGIN AUTHORS NOTE


//PLUGIN START ////////////////////////////////////////////////////////

//use own namespace for plugin
    window.plugin.guardians = function () {};

//delay in ms
    window.plugin.guardians.SYNC_DELAY = 5000;

// maps the JS property names to localStorage keys
    window.plugin.guardians.FIELDS = {
        'guardians': 'plugin-guardians-data',
        'updateQueue': 'plugin-guardians-data-queue',
        'updatingQueue': 'plugin-guardians-data-updating-queue'
    };

    window.plugin.guardians.guardians = {};
    window.plugin.guardians.updateQueue = {};
    window.plugin.guardians.updatingQueue = {};

    window.plugin.guardians.enableSync = false;

    window.plugin.guardians.disabledMessage = null;
    window.plugin.guardians.contentHTML = null;

    window.plugin.guardians.isHighlightActive = false;

    window.plugin.guardians.onPortalDetailsUpdated = function () {
        if(Storage === undefined) {
            $('#portaldetails > .imgpreview').after(plugin.guardians.disabledMessage);
            return;
        }

        var guid = window.selectedPortal,
            details = portalDetail.get(guid),
            nickname = window.PLAYER.nickname;
        if(details) {
            plugin.guardians.updateCaptured(details.owner);
        }

        $('#portaldetails > .imgpreview').after(plugin.guardians.contentHTML);
        plugin.guardians.updateCheckedAndHighlight(guid);
    };

    window.plugin.guardians.onPublicChatDataAvailable = function(data) {
	var nick = window.PLAYER.nickname;
	data.raw.success.forEach(function(msg) {
		var plext = msg[2].plext,
			markup = plext.markup;

		if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==3
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' captured '
		&& markup[2][0] == 'PORTAL') {
		// search for "x captured y"
			var portal = markup[2][1];
			    guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6),
			    date = msg[1];
			if(guid) {
				console.log("running capture");
				 plugin.guardians.setPortalCaptured(date, guid);
			}
		} else if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==4
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your Portal '
		&& markup[1][0] == 'PORTAL'
		&& markup[2][0] == 'TEXT'
		&& (markup[2][1].plain == ' neutralized by ')
		&& markup[3][0] == 'PLAYER') {
		// search for "Your Portal x neutralized by y"
			var portal = markup[1][1];
			    guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6),
			    date = msg[1];
			if(guid) {
				plugin.guardians.setPortalNeutralized(date, guid);
			}
		}
	});
    };

    window.plugin.guardians.updateCheckedAndHighlight = function(guid) {
	runHooks('pluginGuardiansUpdateGuardians', { guid: guid });

	if (guid == window.selectedPortal) {

		var guardianInfo = plugin.guardians.guardians[guid],
			visited = (guardianInfo && guardianInfo.visited) || false,
			captured = (guardianInfo && guardianInfo.captured) || false;
		if (guardianInfo) {
                    var date = new Date(guardianInfo.date);
                    $('#capture-date').html('Captured on :' + date.toDateString());
                    $('#capture-date').attr('title', guid);

		}
	}

	if (window.plugin.guardians.isHighlightActive) {
		if (portals[guid]) {
			window.setMarkerStyle (portals[guid], guid == selectedPortal);
		}
        }
    };


    window.plugin.guardians.setPortalNeutralized = function(date, guid) {
	var madeChange = false,
	    guardianInfo = plugin.guardians.guardians[guid];
	if (guardianInfo && guardianInfo.owner == window.PLAYER.nickname && date > guardianInfo.date) {
		guardianInfo.owner = '';
		guardianInfo.date = date;
	}
	if (madeChange){
		plugin.guardians.updateCheckedAndHighlight(guid);
		console.log('Neutralized ' + guid + ' At time ' + guardianInfo.date);
		plugin.guardians.sync(guid);
	}
    };

    window.plugin.guardians.setPortalCaptured = function(date, guid) {
	var madeChange = false,
	    owner = window.PLAYER.nickname,
	    guardianInfo = plugin.guardians.guardians[guid];
	if (guardianInfo){
		if (date > guardianInfo.date) {
			guardianInfo.owner = window.PLAYER.nickname;
			guardianInfo.date = date;
			madeChange = true;
		}
	} else {
		plugin.guardians.guardians[guid] = {
			owner: owner,
			date: date 
		};
		madeChange = true;
	}
	if (madeChange){
		console.log('Capturing ' + guid +'. Adding ' + owner + ' At time ' + date);
		plugin.guardians.updateCheckedAndHighlight(guid);
		plugin.guardians.sync(guid);
	}
    };

    window.plugin.guardians.updateCaptured = function(owner, guid) {
	var madeChange = false;
	if(guid == undefined) guid = window.selectedPortal;

	var guardianInfo = plugin.guardians.guardians[guid];
	if (!guardianInfo) {
		plugin.guardians.guardians[guid] = guardianInfo = {
			date: 0,
			owner: owner 
		};
		madeChange = true;
	} else if (guardianInfo.owner != owner){
		guardianInfo.owner = owner;
		guardianInfo.date = guardianInfo.date + 1;
		madeChange = true;
	}
	if (madeChange){
		plugin.guardians.updateCheckedAndHighlight(guid);
		console.log('Updating ' + guid +". Adding " + owner + ' At time ' + guardianInfo.date);
		plugin.guardians.sync(guid);
	}
    };

// stores the gived GUID for sync
    plugin.guardians.sync = function(guid) {
	plugin.guardians.updatingQueue[guid] = true;
	plugin.guardians.storeLocal('guardians');
	plugin.guardians.storeLocal('updateQueue');
	plugin.guardians.syncQueue();
    };

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
    };

//Call after IITC and all plugin loaded
    window.plugin.guardians.registerFieldForSyncing = function() {
	if(!window.plugin.sync) {
            return;
        }
	window.plugin.sync.registerMapForSync('guardians', 'guardians', window.plugin.guardians.syncCallback, window.plugin.guardians.syncInitialed);
    };

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
    };

//syncing of the field is initialed, upload all queued update
    window.plugin.guardians.syncInitialed = function(pluginName, fieldName) {
	if(fieldName === 'guardians') {
		plugin.guardians.enableSync = true;
		if(Object.keys(plugin.guardians.updateQueue).length > 0) {
			plugin.guardians.syncQueue();
		}
	}
    };

    window.plugin.guardians.storeLocal = function(name) {
	var key = window.plugin.guardians.FIELDS[name];
	if(key === undefined) return;

	var value = plugin.guardians[name];

	if(typeof value !== 'undefined' && value !== null) {
		localStorage[key] = JSON.stringify(plugin.guardians[name]);
	} else {
		localStorage.removeItem(key);
	}
    };

    window.plugin.guardians.loadLocal = function(name) {
	var key = window.plugin.guardians.FIELDS[name];
	if(key === undefined) return;

	if(localStorage[key] !== undefined) {
		plugin.guardians[name] = JSON.parse(localStorage[key]);
	}
    };

/***************************************************************************************************************************************************************/
/** HIGHLIGHTER ************************************************************************************************************************************************/
/***************************************************************************************************************************************************************/
window.plugin.guardians.highlighter = {
	highlight: function(data) {
		var guid = data.portal.options.ent[0];
		var guardianInfo = window.plugin.guardians.guardians[guid];

		var style = {};

		if (guardianInfo) {
			if (guardianInfo.owner == window.PLAYER.nickname) {
				style.fillColor = 'black';
				style.fillOpacity = 0.6;
				// captured (and, implied, visited too) - no highlights
			}
			if (guardianInfo.owner == window.PLAYER.nickname && guardianInfo.date < Date.now() - 2592000000) {
				style.fillColor = 'red';
				style.fillOpacity = 0.6;
				// captured (and, implied, visited too) - no highlights
			}
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
		+ '<label><span id="capture-date">Empty</span></label>'
		+ '</div>';
	plugin.guardians.disabledMessage = '<div id="guardians-container" class="help" title="Your browser does not support localStorage">Plugin Guardians disabled</div>';
}

window.plugin.guardians.setupPortalsList = function() {
	if(!window.plugin.portalslist) return;

	window.addHook('pluginGuardiansUpdateGuardians', function(data) {
		var info = plugin.guardians.guardians[data.guid];
		if(!info) info = { visited: false, captured: false };

		$('[data-list-guardians="'+data.guid+'"].capture-date').html('is this it');
	});

	window.addHook('pluginGuardiansRefreshAll', function() {
		$('[data-list-guardians]').each(function(i, element) {
			var guid = element.getAttribute("data-list-guardians");

			var info = plugin.guardians.guardians[guid];
			if(!info) info = { date: 0 };

			var e = $(element);
			if(e.hasClass('capture-date')) e.innerHTML('maybe this');
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
			if(!info) info = { date: 0 };

			$(cell).addClass("portal-list-guardians");

			// for some reason, jQuery removes event listeners when the list is sorted. Therefore we use DOM's addEventListener
			$('<span>')
				.prop({
					className: "capture-date",
					title: "Capture Date",
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

window.plugin.guardians.updateList = function(messages) {
  $('#guardians-list').html(messages);
}

window.plugin.guardians.showDialog = function() {
  window.dialog({html: plugin.guardians.dialogHTML, title: 'Guardians', modal: true, id: 'guardians-setting'});
  plugin.guardians.updateList(plugin.guardians.getList());
}

//Count the number of visited and captured portals and produce the string which is displayed
//in the dialog window
    window.plugin.guardians.getList = function() {
        var allLogs = '',
            ccount = 0;
        for (var key in plugin.guardians.guardians){
            var info = plugin.guardians.guardians[key];
            if (info.owner == window.PLAYER.nickname) {
                ccount=ccount+1;
            }
        }
        allLogs += ' ' + 'Captured: ' + ccount + '<br />';
        allLogs += 'Logging: ' + Object.keys(plugin.guardians.guardians).length + '<br />';
	allLogs += '<br />';
	var temp = plugin.guardians.guardians;
        var sortedGuardians = Object.keys(temp).sort( function(keyA, keyB) {
            return temp[keyA].date - temp[keyB].date;
        });
        var print = 0;
        for (i = 0; print < 11;i++){
            var key = sortedGuardians[i],
                info = temp[key];
            if (info.owner == window.PLAYER.nickname) {
                allLogs += 'Held for ' + Math.round((Date.now() - info.date)/86400000) + ' Days<br />';
                print++;
            }
        }
        return allLogs;
    }

    window.plugin.guardians.setupDialog = function() {
	//Create the HTML within the dialog window
        plugin.guardians.dialogHTML = '<div id="guardians-dialog">' +
		'<div id="guardians-list"></div>' +
                '</div>';
  //Add link in the IITC toolbax to display the Guardians dialog
        $('#toolbox').append('<a id="guardians-show-dialog" onclick="window.plugin.guardians.showDialog();">Guardians</a> ');
    }

var setup = function() {
	if($.inArray('pluginGuardiansUpdateGuardians', window.VALID_HOOKS) < 0)
		window.VALID_HOOKS.push('pluginGuardiansUpdateGuardians');
	if($.inArray('pluginGuardiansRefreshAll', window.VALID_HOOKS) < 0)
		window.VALID_HOOKS.push('pluginGuardiansRefreshAll');
	window.plugin.guardians.setupCSS();
	window.plugin.guardians.setupContent();
	window.plugin.guardians.setupDialog();
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

