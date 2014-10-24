var Shell = Shell || {
    commands: {},

    write: function(s, to){
/////
//
	//temporary stand-in
	if ((to) && (s) && (s.charAt(0) != '/')){
	    s = "/w " + to.split(" ", 1)[0] + " " + s;
	}
	sendChat("", s);
//
/////
    },
    writeAndLog: function(s, to){
	Shell.write(s, to);
	log(s);
    },
    writeErr: function(s){
	Shell.writeAndLog(s, "gm");
    },

    registerCommand: function(cmd, sig, desc, fn){
	// error checking
	if (!cmd){
	    var errMsg = "Error: Cannot register empty command";
	    if (sig){
		errMsg += " (signature: " + sig + ")";
	    }
	    Shell.writeErr(errMsg);
	    return;
	}
	if (!fn){
	    Shell.writeErr("Error: Cannot register command \"" + cmd + "\" without a callback");
	    return;
	}

	// fix up the arguments if necessary
	if (cmd.charAt(0) != '!'){
	    cmd = "!" + cmd;
	}
	if (!sig){
	    sig = cmd;
	}

	// check for already-registered command of the same name
	if (Shell.commands[cmd]){
/////
//
	    //if args aren't the same: Shell.writeErr("Error: Command with name \"" + cmd + "\" already registered");
//
/////
	    return;
	}

	// register command
	Shell.commands[cmd] = {
	    signature:		sig,
	    description:	desc,
	    callback:		fn
	};
    },

    unregisterCommand: function(cmd){
	// error checking
	if (!cmd){
	    Shell.writeErr("Error: Cannot unregister empty command");
	    return;
	}

	// fix up argument if necessary
	if (cmd.charAt(0) != '!'){
	    cmd = "!" + cmd;
	}

	// verify command exists
	if (!Shell.commands[cmd]){
	    Shell.writeErr("Error: Command \"" + cmd + "\" not registered");
	    return;
	}

	// unregister command
	delete Shell.commands[cmd];
    },

    tokenize: function(s){
	var retval = [];
	var curTok = "";
	var quote = false;
	while (s.length > 0){
	    if (quote){
		// in quoted string; look for terminating quote
		var idx = s.indexOf(quote);
		if (idx < 0){
		    return "Error: Unmatched " + quote;
		}
		curTok += s.substr(0, idx - 1);
		s = s.substr(idx + 1);
		continue;
	    }
	    var idx = s.search(/[\s'"]/);
	    if (idx < 0){
		// no more quotes or whitespace, just add the rest of the string to the current token and terminate
		curTok += s;
		if (curTok){
		    retval.push(curTok);
		}
		break;
	    }
	    curTok += s.substr(0, idx);
	    var c = s.charAt(idx);
	    s = s.substr(idx + 1);
	    if ((c == "'") || (c == '"')){
		// got a quote; start quoted string
		quote = c;
	    }
	    else{
		// got whitespace; push current token and start looking for a new token
		if (curTok){
		    retval.push(curTok);
		}
		curTok = "";
	    }
	}
	return retval;
    },

    handleChatMessage: function(msg){
	if (msg.type != "api"){ return; }

	// tokenize command string
	var tokens = Shell.tokenize(msg.content);
	if (typeof(tokens) == typeof("")){
	    Shell.writeAndLog(tokens, msg.who);
	    return;
	}
	if (tokens.length <= 0){ return; }

	if (!Shell.commands[tokens[0]]){
	    // ignore unregistered command
	    return;
	}

/////
//
	//verify msg.playerid has permission to execute tokens[0]
//
/////

	// execute command callback
	Shell.commands[tokens[0]].callback(tokens, msg);
    },

    init: function(){
/////
//
	//initialize state.Shell (for storing command permissions)
	//register built-in commands ("!help", permission-related commands)
//
/////
	on("chat:message", Shell.handleChatMessage);
    }
};

on("ready", Shell.init);
