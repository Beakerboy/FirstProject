// ==UserScript==
// @id             iitc-plugin-guardians@Beakerboy
// @name           IITC plugin: Guardians
// @category       Misc
// @version        0.1.3
// @namespace      https://github.com/Beakerboy/FirstProject
// @updateURL      
// @downloadURL    https://github.com/Beakerboy/FirstProject/raw/master/guardians.user.js
// @description    Track the portals you currently control. Highlight older portals red to hilight them as your guardians. Works with the sync plugin to syncronize data between devices.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==

//The guardian object has several parameters;
//owner: who currently owns the portal
//date: The earliest they could have captured the portal
//secondDate: the latest date it could have been captured
//lastAccess: the last time the ownership was verified
//team: the faction the owner is a member of
//teamCheck: the last time the team was verified


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
    window.plugin.guardians.errors = true;
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
            details = portalDetail.get(guid);
        if(details) {
            plugin.guardians.updateCaptured(details.owner, details.team);
        }

        $('#portaldetails > .imgpreview').after(plugin.guardians.contentHTML);
        plugin.guardians.updateCheckedAndHighlight(guid);
    };

/******
*  Parse the COMM data for portal captured messages
*  When found, update the capture records
*****/
    window.plugin.guardians.onPublicChatDataAvailable = function(data) {
	var nick = window.PLAYER.nickname;
	data.result.forEach(function(msg) {
            var plext = msg[2].plext,
                markup = plext.markup;
            if(plext.plextType == 'SYSTEM_BROADCAST' &&
            markup.length==3 &&
            markup[0][0] == 'PLAYER' &&
            markup[1][0] == 'TEXT' &&
            markup[1][1].plain == ' captured ' &&
            markup[2][0] == 'PORTAL') {
		// search for "x captured y"
                var portal = markup[2][1],
                    guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6),
                    owner = markup[0][1].plain,
                    team = markup[0][1].team,
                    date = msg[1];
                if(guid) {
                    if (window.plugin.guardians.errors) {
                        console.log("Found capture at " + markup[2][1].name + ' by ' + owner + ' on ' + date + ' in COMM');
                    }
                    plugin.guardians.setPortalCaptured(owner, team, date, guid);
                    if (window.plugin.guardians.errors) {
                        console.log('Done Running Capture');
                    }
                }
           }/* else if(plext.plextType == 'SYSTEM_NARROWCAST' &&
           markup.length==4 &&
           markup[0][0] == 'TEXT' &&
           markup[0][1].plain == 'Your Portal ' &&
           markup[1][0] == 'PORTAL' &&
           markup[2][0] == 'TEXT' &&
           markup[2][1].plain == ' neutralized by ' &&
           markup[3][0] == 'PLAYER') {
		// search for "Your Portal x neutralized by y"
                var portal = markup[1][1],
                    guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6),
                    date = msg[1];
                if(guid) {
                    plugin.guardians.setPortalNeutralized(date, guid);
                }
           }
 */       });
    };

    window.plugin.guardians.updateCheckedAndHighlight = function(guid) {
        //runHooks('pluginGuardiansUpdateGuardians', { guid: guid });
        if (window.plugin.guardians.errors) {
            console.log('Is guid: ' + guid + ' equal to window.selectedPortal: ' + window.selectedPortal);
        }
        if (guid === window.selectedPortal) {
            var guardianInfo = plugin.guardians.guardians[guid];
            if (window.plugin.guardians.errors) {
                console.log('Does guardianInfo: ' + guardianInfo + ' exist' );
            }  
            if (guardianInfo && guardianInfo.team != 'NEUTRAL') {
                if (window.plugin.guardians.errors) {
                    console.log('updating faction: ' + JSON.stringify(guardianInfo));
                }
                if (guardianInfo.secondDate === undefined) {
                    guardianInfo.secondDate = Date.now();
                }
                var date = new Date(guardianInfo.date),
                    secondDate = new Date(guardianInfo.secondDate),
                    displayText = '';
                if (window.plugin.guardians.display == 'date') {
                    displayText = 'Captured on ' + date.toDateString();
                } else {
                    if (!guardianInfo.exact) {
                        displayText = 'Held between ' + Math.floor((Date.now() - date)/86400000) + ' and ' +Math.floor((Date.now() - secondDate)/86400000) + ' days';
                    } else { 
                        displayText = 'Held for ' + Math.floor((Date.now() - date)/86400000) + ' days'; 
                    }
                }       
                $('#capture-date').html(displayText);
                $('#capture-date').attr('title', guid);
            }
	}
        if (window.plugin.guardians.errors) {
            console.log('isHighlightActive: ' + window.plugin.guardians.isHighlightActive);
        }
	if (window.plugin.guardians.isHighlightActive) {
            if (window.plugin.guardians.errors) {
                console.log('portals[guid]: ' + portals[guid]);
            }
            if (portals[guid]) {
                if (window.plugin.guardians.errors) {
                    console.log('Setting Marker Style');
                }
                window.setMarkerStyle (portals[guid], guid == selectedPortal);
                if (window.plugin.guardians.errors) {
                    console.log('Done Setting Marker Style');
                }
            }
        }
    };


    window.plugin.guardians.setPortalNeutralized = function(date, guid) {
	var madeChange = false,
	    guardianInfo = plugin.guardians.guardians[guid];
	if (guardianInfo && guardianInfo.owner == window.PLAYER.nickname && date > guardianInfo.date) {
		guardianInfo.owner = '';
                guardian.team = 'NEUTRAL';
		guardianInfo.date = date;
                guardianInfo.lastAccess = date;
                guardianInfo.secondDate = date;
                guardianInfo.exact = true;
	}
	if (madeChange){
		plugin.guardians.updateCheckedAndHighlight(guid);
		console.log('Neutralized ' + guid + ' At time ' + guardianInfo.date);
		plugin.guardians.sync(guid);
	}
    };

/******
*  Given a guid, owner, team, and date, update the record if appropriate
*****/
    window.plugin.guardians.setPortalCaptured = function(owner, team, date, guid) {
	var madeChange = false,
	    guardianInfo = plugin.guardians.guardians[guid];
	if (window.plugin.guardians.track == 'self' && owner == window.PLAYER.nickname || window.plugin.guardians.track == 'all') {
            //If we already have an entry for this portal, update values
            if (guardianInfo){
                //Only update the info if this capture date is more recent then the one that is currently saved
                    if (window.plugin.guardians.errors) {
                        console.log('Is date:' + date + ' > guardianInfo.date:' + guardianInfo.date);
                    }
                if (date > guardianInfo.date) {
                    if (window.plugin.guardians.errors) {
                        console.log('Current capture is more recent');
                    }
                    guardianInfo.owner = owner;
                    guardianInfo.team = team;
                    guardianInfo.teamCheck = date;
                    guardianInfo.date = date;
                    guardianInfo.lastAccess = date;
                    guardianInfo.secondDate = date;
                    guardianInfo.exact = true;
                    madeChange = true;
                }
            //Otherwise, create a new one
            } else {
                plugin.guardians.guardians[guid] = {
                    owner: owner,
                    team: team,
                    teamCheck: date,
                    secondDate: date,
                    lastAccess: date,
                    date: date,
                    exact: true
                };
                madeChange = true;
            }
        }
	if (madeChange){
		console.log('Capturing ' + guid +'. Adding ' + owner + ' At time ' + date);
		plugin.guardians.updateCheckedAndHighlight(guid);
		plugin.guardians.sync(guid);
	}
    };

    window.plugin.guardians.updateCaptured = function(owner, team, guid) {
	if(guid === undefined) guid = window.selectedPortal;

	var guardianInfo = plugin.guardians.guardians[guid],
            nick = window.PLAYER.nickname,
            date = Date.now();
	    madeChange = false;
	if (window.plugin.guardians.track == 'all' || window.plugin.guardians.track == 'self' && (owner == nick || (guardianInfo && guardianInfo.owner == nick))) {
            madeChange = true;
            if (!guardianInfo) {
		plugin.guardians.guardians[guid] = guardianInfo = {
                    date: 0,
                    team: team,
                    teamCheck: date,
                    lastViewed: date,
                    secondDate: date,
                    owner: owner,
                    exact: false 
		};
            } else if (guardianInfo.owner != owner && guardianInfo.owner != ''){
		guardianInfo.owner = owner;
                if (guardianInfo.lastAccess === undefined) {
                    guardianInfo.date = guardianInfo.date + 1;
                } else if (guardianInfo.team != team){
                    guardianInfo.date = guardianInfo.teamCheck + 1; 
                } else {
                    guardianInfo.date = guardianInfo.lastAccess + 1;
                }
                guardianInfo.team = team;
                guardianInfo.exact = false;
                guardianInfo.secondDate = date;
	    } else if (guardianInfo.owner == '') {
                guardianInfo.owner = owner;
            }
            if (guardianInfo.secondDate === undefined) {
                guardianInfo.secondDate = date;
            }
            guardianInfo.lastAccess = date;
            guardianInfo.teamCheck = date;
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
            if (window.plugin.guardians.errors) {
                console.log('In Highlighter');
            }
            var guid = data.portal.options.ent[0],
                team = data.portal.options.ent[2].team,
                guardianInfo = window.plugin.guardians.guardians[guid],
                madeChange = false,
                date = Date.now(),
		style = {};
            if (guardianInfo) {
                if (window.plugin.guardians.track == 'all' || window.plugin.guardians.track == 'self' && guardianInfo.owner == window.PLAYER.nickname) {
                    var days = Math.floor((Date.now() - guardianInfo.date) / 86400000),
                        color = Math.min(255, days * 2);
                    
                    if (guardianInfo.team === undefined) {
                        guardianInfo.team = team;
                        guardianInfo.teamCheck = date;
                        madeChange = true;
                    } else if (guardianInfo.team != team) {
                        //if portal ownership has changed singe it was last looked at
                        //clear the owner, reset the team, and set the earliest capture time to the latest time owner or 
                        //allignment was verified plus one.  Should I really set the sencondDate or wait until the owner is verified? 
                        guardianInfo.owner = '';
                        guardianInfo.team = team;
                        guardianInfo.date = Math.max(guardianInfo.date, guardianInfo.lastAccess, guardianInfo.teamCheck) + 1;
                        guardianInfo.exact = false;
                        guardianInfo.teamCheck = date;
                        guardianInfo.secondDate = date;
                 
                        madeChange = true;
                    }
                    if (guardianInfo.team != 'NEUTRAL') {
                        style.fillColor = 'rgb(' + color + ', 0, 0)';
                        style.fillOpacity = 0.6;
                        if (guardianInfo.owner == '') {
                            style.fillColor = 'purple';
                            style.fillOpacity = 0.0;
                        }
                        var days = Math.floor((Date.now() - guardianInfo.date) / 86400000);
                        if (days < 10) {
                            data.portal.addTo(window.plugin.guardians.bronzeLayerGroup); 
                        } else if (days < 20) {
                            data.portal.addTo(window.plugin.guardians.silverLayerGroup); 
                        } else if (days < 90) {
                            data.portal.addTo(window.plugin.guardians.goldLayerGroup); 
                        } else if (days < 150) {
                            data.portal.addTo(window.plugin.guardians.platinumLayerGroup); 
                        } else {
                            data.portal.addTo(window.plugin.guardians.onyxLayerGroup); 
                        }
                    }
                }
            } else if(window.plugin.guardians.track == 'all') {
                //No existing data for this portal, so create what we can. Since we only no the owner of a selected portal
                //this is only perfomed when tracking all.
                plugin.guardians.guardians[guid] = {
                    team: team,
                    teamCheck: date,
                    secondDate: date,
                    owner: '',
                    date: 0,
                    lastAccess: date,
                    exact:false 
                };
                madeChange = true;
            }
            if (madeChange) {
		plugin.guardians.sync(guid);
            }
            data.portal.setStyle(style);
	},

        setSelected: function(active) {
            window.plugin.guardians.isHighlightActive = active;
        }
    };


    window.plugin.guardians.setupCSS = function() {
	$("<style>")
	.prop("type", "text/css")
	.html("#guardians-container {\n  display: block;\n  text-align: center;\n  margin: 6px 3px 1px 3px;\n  padding: 0 4px;\n}\n#guardians-container label {\n  margin: 0 0.5em;\n}\n#guardians-container input {\n  vertical-align: middle;\n}\n\n.portal-list-guardians input[type=\'checkbox\'] {\n  padding: 0;\n  height: auto;\n  margin-top: -5px;\n  margin-bottom: -5px;\n}\n")
	.appendTo("head");
    };

    window.plugin.guardians.setupContent = function() {
        plugin.guardians.contentHTML = '<div id="guardians-container">' +
            '<label><span id="capture-date"></span></label>' +
            '</div>';
        plugin.guardians.disabledMessage = '<div id="guardians-container" class="help" title="Your browser does not support localStorage">Plugin Guardians disabled</div>';
    };

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
    };

    window.plugin.guardians.updateList = function(messages) {
        $('#guardians-list').html(messages);
    };

    window.plugin.guardians.showDialog = function() {
        window.dialog({html: plugin.guardians.dialogHTML, title: 'Guardians', modal: true, id: 'guardians-setting'});
        plugin.guardians.updateList(plugin.guardians.getList());
    };

//Count the number of visited and captured portals and produce the string which is displayed
//in the dialog window
    window.plugin.guardians.getList = function() {
        var allLogs = '',
            ccount = 0;
        for (var key in plugin.guardians.guardians){
            //console.log(JSON.stringify(plugin.guardians.guardians[key]));
            var info = plugin.guardians.guardians[key];
            if (info.owner === window.PLAYER.nickname) {
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
            console.log(key + ': ' +  JSON.stringify(info));
            if (info.owner === window.PLAYER.nickname) {
                allLogs += 'Held for ' + Math.floor((Date.now() - info.date)/86400000) + ' Days<br />';
                print++;
            }
        }
        return allLogs;
    };

    window.plugin.guardians.setupDialog = function() {
	//Create the HTML within the dialog window
        plugin.guardians.dialogHTML = '<div id="guardians-dialog">' +
		'<div id="guardians-list"></div>' +
                '</div>';
  //Add link in the IITC toolbax to display the Guardians dialog
        $('#toolbox').append('<a id="guardians-show-dialog" onclick="window.plugin.guardians.showDialog();">Guardians</a> ');
    };

    window.plugin.guardians.setupLayers = function () {
        window.plugin.guardians.bronzeLayerGroup = new L.LayerGroup();
        window.plugin.guardians.silverLayerGroup = new L.LayerGroup();
        window.plugin.guardians.goldLayerGroup = new L.LayerGroup();
        window.plugin.guardians.platinumLayerGroup = new L.LayerGroup();
        window.plugin.guardians.onyxLayerGroup = new L.LayerGroup();

        window.addLayerGroup('Bronze Guardians', window.plugin.guardians.bronzeLayerGroup, true);
        window.addLayerGroup('Silver Guardians', window.plugin.guardians.silverLayerGroup, true);
        window.addLayerGroup('Gold Guardians', window.plugin.guardians.goldLayerGroup, true);
        window.addLayerGroup('Platinum Guardians', window.plugin.guardians.platinumLayerGroup, true);
        window.addLayerGroup('Onyx Guardians', window.plugin.guardians.onyxLayerGroup, true);
    };

    window.plugin.guardians.loadOptions = function () {
        var guardianInfo = plugin.guardians.guardians['options'];
        if (guardianInfo === undefined) {
            //can be all or self.
            //TO DO: add a uniques option and an array of player names to track
            window.plugin.guardians.track = 'all';
            window.plugin.guardians.trackPlayer = "";
            //Can be 'date' or 'days'
            window.plugin.guardians.display = 'days';
        } else {
            window.plugin.guardians.track = guardianInfo.track;
            window.plugin.guardians.display = guardianInfo.display;
        }
    };

var setup = function() {
	if($.inArray('pluginGuardiansUpdateGuardians', window.VALID_HOOKS) < 0)
		window.VALID_HOOKS.push('pluginGuardiansUpdateGuardians');
	if($.inArray('pluginGuardiansRefreshAll', window.VALID_HOOKS) < 0)
		window.VALID_HOOKS.push('pluginGuardiansRefreshAll');
	window.plugin.guardians.setupCSS();
	window.plugin.guardians.setupContent();
	window.plugin.guardians.setupDialog();
	window.plugin.guardians.setupLayers();
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
        window.plugin.guardians.loadOptions();
};

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

