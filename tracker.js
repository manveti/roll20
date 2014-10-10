var Tracker = Tracker || {
    ALL_STATUSES:  ["red", "blue", "green", "brown", "purple", "pink", "yellow",
		    "dead", "skull", "sleepy", "half-heart", "half-haze", "interdiction", "snail", "lightning-helix", "spanner",
		    "chained-heart", "chemical-bolt", "death-zone", "drink-me", "edge-crack", "ninja-mask", "stopwatch",
		    "fishing-net", "overdrive", "strong", "fist", "padlock", "three-leaves", "fluffy-wing", "pummeled", "tread",
		    "arrowed", "aura", "back-pain", "black-flag", "bleeding-eye", "bolt-shield", "broken-heart", "cobweb",
		    "broken-shield", "flying-flag", "radioactive", "trophy", "broken-skull", "frozen-orb", "rolling-bomb",
		    "white-tower", "grab", "screaming", "grenade", "sentry-gun", "all-for-one", "angel-outfit", "archery-target"],

    STATUS_ALIASES: {'stun': "sleepy", 'haste': "tread"},

    CONFIG_PARAMS: [['announceRounds',		"Announce Each Round"],
		    ['announceTurns',		"Announce Each Player's Turn"],
		    ['announceExpiration',	"Announce Status Expirations"],
		    ['highToLow',		"High-to-Low Initiative Order"]],


    initConfig: function(){
	if (state.hasOwnProperty('InitiativeTracker')){ return; }
	state.InitiativeTracker = {
				    'highToLow':		true,
				    'announceRounds':		true,
				    'announceTurns':		true,
				    'announceExpiration':	true
	};
    },

    reset: function(){
	state.InitiativeTracker.round = null;
	state.InitiativeTracker.count = null;
	state.InitiativeTracker.status = [];
    },

    announceRound: function(round){
	if (!state.InitiativeTracker.announceRounds){ return; }
	sendChat("", "/desc Start of Round " + round);
    },

    announceTurn: function(count, tokenName, tokenId){
	if (!state.InitiativeTracker.announceTurns){ return; }
	if (!tokenName){
	    var token = getObj("graphic", tokenId);
	    if (token){ tokenName = token.get('name'); }
	}
	sendChat("", "/desc Start of Turn " + state.InitiativeTracker.round + " for " + tokenName + " (" + count + ")");
    },

    announceStatusExpiration: function(status, tokenName){
	if (!state.InitiativeTracker.announceExpiration){ return; }
	sendChat("", "/desc Status " + status + " expired on " + tokenName);
    },

    handleTurnChange: function(newTurnOrder, oldTurnOrder){
	var newTurns = JSON.parse(newTurnOrder.get('turnorder') || "[]");
	var oldTurns = JSON.parse(oldTurnOrder.turnorder || "[]");

	if ((!newTurns) || (!oldTurns)){ return; }

	if ((newTurns.length == 0) && (oldTurns.length > 0)){ return Tracker.reset(); } // turn order was cleared; reset

	if ((!newTurns.length) || (newTurns.length != oldTurns.length)){ return; } // something was added or removed; ignore

	if ((state.InitiativeTracker.round == null) || (state.InitiativeTracker.count == null)){
	    // first change: see if it's time to start tracking
	    var startTracking = false;
	    for (var i = 0; i < newTurns.length; i++){
		if (newTurns[i].id != oldTurns[i].id){
		    // turn order was sorted; start tracking
		    startTracking = true;
		    break;
		}
		if (newTurns[i].pr != oldTurns[i].pr){ break; } // a token's initiative count was changed; don't start tracking yet
	    }
	    if (!startTracking){ return; }
	    state.InitiativeTracker.round = 1;
	    state.InitiativeTracker.count = newTurns[0].pr;
	    Tracker.announceRound(state.InitiativeTracker.round);
	    Tracker.announceTurn(newTurns[0].pr, newTurns[0].custom, newTurns[0].id);
	    return;
	}

	if (newTurns[0].id == oldTurns[0].id){ return; } // turn didn't change

	var newCount = newTurns[0].pr;
	var oldCount = state.InitiativeTracker.count;
	if (!state.InitiativeTracker.highToLow){
	    // use negatives for low-to-high initiative so inequalities work out the same as high-to-low
	    newCount = -newCount;
	    oldCount = -oldCount;
	}

	var roundChanged = newCount > oldCount;

	if (roundChanged){
	    // made it back to the top of the initiative order
	    state.InitiativeTracker.round += 1;
	    Tracker.announceRound(state.InitiativeTracker.round);
	}

	if (newTurns[0].pr != state.InitiativeTracker.count){
	    // update statuses that update between the last count and this count
	    for (var i = 0; i < state.InitiativeTracker.status.length; i++){
		var status = state.InitiativeTracker.status[i];
		var token = getObj("graphic", status.token);
		if (!token){
		    // token associated with this status doesn't exist anymore; remove it
		    state.InitiativeTracker.status.splice(i, 1);
		    i -= 1;
		    continue;
		}
		var statusCount = status.count;
		if (!state.InitiativeTracker.highToLow){ statusCount = -statusCount; }
		if ((roundChanged) && (statusCount > oldCount) && (statusCount < newCount)){ continue; } // status not between last count and this count
		if ((!roundChanged) && ((statusCount > oldCount) || (statusCount < newCount))){ continue; }
		if (status.expires <= state.InitiativeTracker.round){
		    // status expired; remove marker and announce expiration
		    token.set("status_" + status.status, false);
		    state.InitiativeTracker.status.splice(i, 1);
		    i -= 1;
		    Tracker.announceStatusExpiration(status.name, token.get('name'));
		}
		else if (status.expires - state.InitiativeTracker.round < 10){
		    // status has nine or fewer rounds left; update marker to reflect remaining rounds
		    token.set("status_" + status.status, status.expires - state.InitiativeTracker.round);
		}
	    }
	}

	state.InitiativeTracker.count = newTurns[0].pr;
	Tracker.announceTurn(newTurns[0].pr, newTurns[0].custom, newTurns[0].id);
    },

    getConfigParam: function(param){
	if (param == null){
	    for (var i = 0; i < Tracker.CONFIG_PARAMS.length; i++){
		var head = Tracker.CONFIG_PARAMS[i][1] + " (" + Tracker.CONFIG_PARAMS[i][0] + "): ";
		sendChat("Tracker", head + state.InitiativeTracker[Tracker.CONFIG_PARAMS[i][0]]);
	    }
	}
	else {
	    var err = true;
	    for (var i = 0; i < CONFIG_PARAMS.length; i++){
		if (Tracker.CONFIG_PARAMS[i][0] == param){
		    var head = Tracker.CONFIG_PARAMS[i][1] + " (" + Tracker.CONFIG_PARAMS[i][0] + "): ";
		    sendChat("Tracker", head + state.InitiativeTracker[Tracker.CONFIG_PARAMS[i][0]]);
		    err = false;
		    break;
		}
	    }
	    if (err){
		sendChat("Tracker", "Error: Config parameter '" + param + "' not found");
	    }
	}
    },

    setConfigParam: function(param, value){
	var err = true;
	for (var i = 0; i < Tracker.CONFIG_PARAMS.length; i++){
	    if (CONFIG_PARAMS[i][0] == param){
		state.InitiativeTracker[Tracker.CONFIG_PARAMS[i][0]] = (value == null ? !state.InitiativeTracker[Tracker.CONFIG_PARAMS[i][0]] : value);
		err = false;
		break;
	    }
	}
	if (err){
	    sendChat("Tracker", "Error: Config parameter '" + param + "' not found");
	}
    },

    showTrackerHelp: function(cmd){
	sendChat("Tracker", cmd + " commands:");
	sendChat("Tracker", "help:               display this help message");
	sendChat("Tracker", "get [PARAM]:        display the value of the specified config parameter, or all config parameters");
	sendChat("Tracker", "set PARAM [VALUE]:  set the specified config parameter to the specified value (defaults to true)");
	sendChat("Tracker", "enable PARAM:       set the specified config parameter to true");
	sendChat("Tracker", "disable PARAM:      set the specified config parameter to false");
	sendChat("Tracker", "toggle PARAM:       toggle the specified config parameter between true and false");
    },

    handleTrackerMessage: function(msg){
	var tokens = msg.split(" ");
	if (tokens.length < 2){ return Tracker.showTrackerHelp(tokens[0]); }
	switch (tokens[1]){
	case "get":
	    if (tokens.length <= 2){ Tracker.getConfigParam(null); }
	    else { Tracker.getConfigParam(tokens[2]); }
	    break;
	case "set":
	    if (tokens.length <= 2){
		sendChat("Tracker", "Error: The 'set' command requires at least one argument (the parameter to set)");
		break;
	    }
	    var value = true;
	    if (tokens.length > 3){
		if ((tokens[3] != "true") && (tokens[3] != "yes") && (tokens[3] != "1")){ value = false; }
	    }
	    Tracker.setConfigParam(tokens[2], value);
	    break;
	case "enable":
	    if (tokens.length != 3){
		sendChat("Tracker", "Error: The 'enable' command requires exactly one argument (the parameter to enable)");
		break;
	    }
	    Tracker.setConfigParam(tokens[2], true);
	    break;
	case "disable":
	    if (tokens.length != 3){
		sendChat("Tracker", "Error: The 'disable' command requires exactly one argument (the parameter to disble)");
		break;
	    }
	    Tracker.setConfigParam(tokens[2], false);
	    break;
	case "toggle":
	    if (tokens.length != 3){
		sendChat("Tracker", "Error: The 'toggle' command requires exactly one argument (the parameter to toggle)");
		break;
	    }
	    Tracker.setConfigParam(tokens[2], null);
	    break;
	case "help":
	    Tracker.showTrackerHelp(tokens[0]);
	    break;
	default:
	    sendChat("Tracker", "Error: Unrecognized command: " + tokens[0]);
	    Tracker.showTrackerHelp(tokens[0]);
	}
    },

    addStatus: function(tokenId, duration, status, name){
	var token = getObj("graphic", tokenId);
	if (!token){ return; }
	if (Tracker.STATUS_ALIASES[status]){ status = Tracker.STATUS_ALIASES[status]; }
	state.InitiativeTracker.status.push({'token':	tokenId,
					    'expires':	state.InitiativeTracker.round + duration,
					    'count':	state.InitiativeTracker.count,
					    'status':	status,
					    'name':	name});
	if (duration > 10){ duration = true; }
	token.set("status_" + status, duration);
    },

    showStatusHelp: function(cmd){
	sendChat("Tracker", cmd + " commands:");
	sendChat("Tracker", "help:               display this help message");
	sendChat("Tracker", "add DUR ICON DESC:  add DUR rounds of status effect with specified icon and description to selected tokens");
	sendChat("Tracker", "list:               list all status effects for selected tokens");
	sendChat("Tracker", "show:               synonym for list");
	sendChat("Tracker", "remove [ID]:        remove specified status effect, or all status effects from selected tokens");
	sendChat("Tracker", "rem, delete, del:   synonyms for remove");
	sendChat("Tracker", "icons:              list available status icons and aliases");
    },

    handleStatusMessage: function(msg, selected){
	var tokens = msg.split(" ");
	if (tokens.length < 2){ return Tracker.showStatusHelp(tokens[0]); }
	switch (tokens[1]){
	case "add":
	    if ((!selected) || (selected.length <= 0)){
		sendChat("Tracker", "Error: The 'add' command requires at least one selected token");
		break;
	    }
	    if (tokens.length < 5){
		sendChat("Tracker", "Error: The 'add' command requires three arguments (duration, icon, description)");
		break;
	    }
	    if (state.InitiativeTracker.round <= 0){
		sendChat("Tracker", "Error: Initiative not being tracked");
		break;
	    }
	    for (var i = 0; i < selected.length; i++){
		if (selected[i]._type != "graphic"){ continue; }
		var token = getObj(selected[i]._type, selected[i]._id);
		if (!token){ continue; }
		Tracker.addStatus(selected[i]._id, parseInt(tokens[2]), tokens[3], tokens.slice(4).join(" "));
	    }
	    break;
	case "list":
	case "show":
	    if ((!selected) || (selected.length <= 0)){
		sendChat("Tracker", "Error: The '" + tokens[1] + "' command requires at least one selected token");
		break;
	    }
	    var tokenIds = [];
	    var byToken = {};
	    var tokenNames = {};
	    for (var i = 0; i < selected.length; i++){
		if (selected[i]._type != "graphic"){ continue; }
		var token = getObj(selected[i]._type, selected[i]._id);
		if (!token){ continue; }
		tokenIds.push(selected[i]._id);
		byToken[selected[i]._id] = [];
		tokenNames[selected[i]._id] = token.get('name');
	    }
	    tokenIds.sort(function(x, y){
				if (tokenNames[x] == tokenNames[y]){ return 0; }
				if (tokenNames[x] > tokenNames[y]){ return 1; }
				return -1;
			    });
	    for (var i = 0; i < state.InitiativeTracker.status.length; i++){
		var status = state.InitiativeTracker.status[i];
		if (!byToken[status.token]){ continue; }
		var duration = status.expires - state.InitiativeTracker.round;
		if ((state.InitiativeTracker.highToLow) && (status.count < state.InitiativeTracker.count)){
		    duration += 1;
		}
		if ((!state.InitiativeTracker.highToLow) && (status.count > state.InitiativeTracker.count)){
		    duration += 1;
		}
		byToken[status.token].push("" + i + ": " + status.name + " (" + duration + ")");
	    }
	    for (var i = 0; i < tokenIds.length; i++){
		if (byToken[tokenIds[i]].length <= 0){
		    sendChat("", "/desc No status effects for token " + tokenNames[tokenIds[i]]);
		    continue;
		}
		sendChat("", "/desc Status effects for token " + tokenNames[tokenIds[i]] + ":");
		for (var j = 0; j < byToken[tokenIds[i]].length; j++){
		    sendChat("", byToken[tokenIds[i]][j]);
		}
	    }
	    break;
	case "remove":
	case "rem":
	case "delete":
	case "del":
	    if ((tokens.length == 2) && (selected) && (selected.length > 0)){
		// some tokens selected and no ID specified; remove all status effects from selected tokens
		for (var i = 0; i < state.InitiativeTracker.status.length; i++){
		    var status = state.InitiativeTracker.status[i];
		    for (var j = 0; j < selected.length; j++){
			if ((selected[j]._type != "graphic") || (selected[j]._id != status.token)){ continue; }
			var token = getObj(selected[j]._type, selected[j]._id);
			if (!token){ continue; }
			token.set("status_" + status.status, false);
			state.InitiativeTracker.status.splice(i, 1);
			i -= 1;
			break;
		    }
		}
		break;
	    }
	    // ID specified or nothing selected; require ID and remove specified status effect
	    if (tokens.length != 3){
		sendChat("Tracker", "Error: The '" + tokens[1] + "' command requires an argument (status effect ID)");
		break;
	    }
	    var idx = parseInt(tokens[2]);
	    if ((idx < 0) || (idx >= state.InitiativeTracker.status.length)){
		sendChat("Tracker", "Error: Invalid status effect ID: " + tokens[2]);
		break;
	    }
	    var status = state.InitiativeTracker.status[idx];
	    var token = getObj("graphic", status.token);
	    token.set("status_" + status.status, false);
	    state.InitiativeTracker.status.splice(idx, 1);
	    break;
	case "icons":
	    sendChat("Tracker", "Status Icons: " + Tracker.ALL_STATUSES.join(", "));
	    sendChat("Tracker", "Status Aliases:");
	    for (var k in Tracker.STATUS_ALIASES){
		sendChat("Tracker", k + ": " + Tracker.STATUS_ALIASES[k]);
	    }
	    break;
	case "help":
	    Tracker.showStatusHelp(tokens[0]);
	    break;
	default:
	    sendChat("Tracker", "Error: Unrecognized command: " + tokens[0]);
	    Tracker.showStatusHelp(tokens[0]);
	}
    },

    handleChatMessage: function(msg){
	if (msg.type != "api"){ return; }

	if ((msg.content == "!tracker") || (msg.content.indexOf("!tracker ") == 0)){ return Tracker.handleTrackerMessage(msg.content); }
	if ((msg.content == "!status") || (msg.content.indexOf("!status ") == 0)){ return Tracker.handleStatusMessage(msg.content, msg.selected); }
    },

    registerTracker: function(){
	Tracker.initConfig();
	on("change:campaign:turnorder", Tracker.handleTurnChange);
	on("chat:message", Tracker.handleChatMessage);
    }
};

on("ready", function(){ Tracker.registerTracker(); })
