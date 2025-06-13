var T20Npc = T20Npc || {
    // keep damage conditions in order of increasing severity (i.e. opposite to recovery order)
    DAMAGE_CONDITIONS: ["bruised", "hurt", "dazed", "wounded", "staggered", "disabled", "unconscious", "dying", "dead"],
    BOOLEAN_CONDITIONS: ["staggered", "disabled", "unconscious", "dying", "dead"],
    NONLETHAL_COUNTERPARTS: {
        "hurt": "bruised",
        "wounded": "dazed",
        "disabled": "staggered",
        "dying": "unconscious"
    },
    SAVE_NAMES: {
        "ref": "Reflex",
        "fort": "Fortitude",
        "will": "Will"
    },
    SKILL_NAMES: {
        "acro": "Acrobatics",
        "bluff": "Bluff",
        "climb": "Climb",
        "comp": "Computers",
        "conc": "Concentration",
        "diplo": "Diplomacy",
        "disdev": "Disable Device",
        "disguise": "Disguise",
        "drive": "Drive",
        "escape": "Escape Artist",
        "ginfo": "Gather Information",
        "hanimal": "Handle Animal",
        "intim": "Intimidate",
        "jump": "Jump",
        "med": "Medicine",
        "notice": "Notice",
        "pilot": "Pilot",
        "ride": "Ride",
        "search": "Search",
        "sensmot": "Sense Motive",
        "soh": "Sleight of Hand",
        "stealth": "Stealth",
        "survival": "Survival",
        "swim": "Swim",
    },
    SKILLS_BY_NAME: {},

    // clear all stored damage
    clearDamage: function() {
        state.t20npc.damage = {};
    },

    // display damage track for specified token
    displayDamage: function(tokenId) {
        let hasDmg = false;
        let isDead = false;
        let msg = "&{template:True20Damage}";
        if (state.t20npc.damage.hasOwnProperty(tokenId)) {
            let dmg = state.t20npc.damage[tokenId];
            for (const prop of T20Npc.DAMAGE_CONDITIONS) {
                if ((dmg.hasOwnProperty(prop)) && (dmg[prop] > 0)) {
                    msg += ` {{${prop}=${dmg[prop]}}}`;
                }
                hasDmg = true;
            }
            if ((dmg.hasOwnProperty("dead")) && (dmg["dead"] > 0)) {
                hasDmg = true;
                isDead = true;
            }
        }
        if (!hasDmg) {
            msg = "Undamaged";
        }
        let from = "T20NPC";
        let token = getObj("graphic", tokenId);
        if (token) {
            from = token.get("name") || from;
        }
        sendChat(from, `/w gm ${msg}`);
        if (isDead) {
        sendChat(from, `/w gm Dead`);
        }
    },

    // roll a toughness save for specified token.
    // if a DC is specified, apply damage as appropriate
    rollToughness: function(tokenId, lethal, dc) {
        let token = getObj("graphic", tokenId);
        if ((!token) || (!token.get("represents"))) { return; }
        let character = getObj("character", token.get("represents"));
        if ((!character) || (!character.get("name"))) { return; }
        let charName = character.get("name");
        let name = token.get("name") || charName;
        let prefix = `&{template:True20Generic} {{name=${name}}} {{subtags=Toughness Save}} {{Result=[[`;
        let bonus = `@{${charName}|toughness}[toughness]`;
        if (state.t20npc.damage.hasOwnProperty(tokenId)) {
            let dmg = state.t20npc.damage[tokenId];
            let conds = ["bruised", "dazed"];
            if (lethal){
                conds = ["hurt", "wounded"];
            }
            for (const cond of conds) {
                if (dmg.hasOwnProperty(cond)) {
                    bonus += ` - ${dmg[cond]}[${cond}]`;
                }
            }
        }
        let suffix = ` + ${bonus} ]]}} {{notes=@{${charName}|toughness_note} }}`;
        if (dc) {
            function rollToughnessCallback(msg) {
                let result = msg[0].inlinerolls[0].results.total;
                let roll = msg[0].inlinerolls[0].results.rolls[0].results[0].v;
                if (roll == 20) {
                    roll = `${roll}[1d20]+1d0cs>0`;
                }
                else if (roll == 1) {
                    roll = `${roll}[1d20]+1d0cf<1cs>1`;
                }
                else {
                    roll = `${roll}[1d20]+1d0cs>1`;
                }
                sendChat(name, `/w gm ${prefix}${roll}${suffix}`);
                let mof = dc - result;
                let condition = null;
                if ((roll == 20) && (mof >= 10)) {
                    mof = 9;  // nat 20 means at most wounded/dazed
                }
                if ((roll == 1) && (mof <= 0)) {
                    mof = 1;  // nat 1 means at least hurt/bruised
                }
                if (mof <= 0) {
                    return;  // successful save
                }
                else if (mof < 5) {
                    condition = (lethal ? "hurt" : "bruised");
                }
                else if (mof < 10) {
                    condition = (lethal ? "wounded" : "dazed");
                }
                else if (mof < 15) {
                    condition = (lethal ? "disabled" : "staggered");
                }
                else if ((mof < 20) || (!lethal)) {
                    condition = (lethal ? "dying" : "unconscious");
                }
                else {
                    condition = "dead";
                }
                setTimeout(function() { T20Npc.addDamage(tokenId, condition); }, 100);  // delay 100ms for output ordering
            }
            sendChat("", `[[1d20 + ${bonus}]]`, rollToughnessCallback);
        }
        else {
            sendChat(name, `/w gm ${prefix}1d20${suffix}`);
        }
    },

    // add the specified damage condition to the specified token, upgrading if necessary
    addDamage: function(tokenId, condition) {
        condition = condition.toLowerCase();
        if (!T20Npc.DAMAGE_CONDITIONS.includes(condition)) { return; }
        let token = getObj("graphic", tokenId);
        if (!token) { return; }
        if (!state.t20npc.damage.hasOwnProperty(tokenId)) {
            state.t20npc.damage[tokenId] = {};
        }
        // upgrade if necessary: staggered->unconscious, disabled->dying->dead
        if ((condition == "staggered") && ((state.t20npc.damage[tokenId]["staggered"] || 0) > 0)) {
            condition = "unconscious";
        }
        if ((condition == "disabled") && ((state.t20npc.damage[tokenId]["disabled"] || 0) > 0)) {
            condition = "dying";
        }
        if ((condition == "dying") && ((state.t20npc.damage[tokenId]["dying"] || 0) > 0)) {
            condition = "dead";
        }
        state.t20npc.damage[tokenId][condition] = (state.t20npc.damage[tokenId][condition] || 0) + 1;
        // apply nonlethal counterpart if necessary
        if (T20Npc.NONLETHAL_COUNTERPARTS.hasOwnProperty(condition)) {
            let nlCond = T20Npc.NONLETHAL_COUNTERPARTS[condition];
            if ((nlCond == "staggered") || (nlCond == "unconscious")) {
                state.t20npc.damage[tokenId][nlCond] = 1;
            }
            else {
                state.t20npc.damage[tokenId][nlCond] = (state.t20npc.damage[tokenId][nlCond] || 0) + 1;
            }
        }
        // apply status markers
        let extra = "";
        switch (condition) {
        case "wounded":
        case "dazed":
            token.set("status_stopwatch", 1);
            if (condition == "dazed") {
                extra = "; dazed for 1 round";
            }
            else {
                // TODO: status marker for shaken
                extra = "; stunned for 1 round";
            }
            break;
        case "disabled":
        case "staggered":
            token.set("status_pummeled", true);
            token.set("status_stopwatch", 1);
            extra = "; dazed for 1 round; -2 to Defense";
            break;
        case "dying":
            token.set("status_skull", true);
            extra = "; unconscious";
            // fall through to unconscious
        case "unconscious":
            token.set("status_sleepy", true);
            break;
        case "dead":
            token.set("status_dead", true);
            break;
        }
        // report applied damage condition
        let from = token.get("name") || "T20NPC";
        sendChat(from, `/w gm Damage applied: ${condition}${extra}`);
    },

    // heal the worst n damage conditions on the specified token (defaulting to n=1)
    healDamage: function(tokenId, n) {
        if (!state.t20npc.damage.hasOwnProperty(tokenId)) { return; }
        if (!n) {
            n = 1;
        }
        let condId = T20Npc.DAMAGE_CONDITIONS.length - 1;
        let cond = T20Npc.DAMAGE_CONDITIONS[condId];
        while ((condId >= 0 ) && (n > 0)) {
            if ((state.t20npc.damage[tokenId][cond] || 0) > 0) {
                // TODO: batch this to minimize writes to state
                state.t20npc.damage[tokenId][cond] = state.t20npc.damage[tokenId][cond] - 1;
                n -= 1;
                // TODO: if all conditions of this level cleared, clear associated status marker (if applicable)
            }
            else {
                cond -= 1;
            }
        }
    },

    // modify the damage conditions on the specified token
    modifyDamage: function(tokenId, mods) {
        if (!state.t20npc.damage.hasOwnProperty(tokenId)) {
            state.t20npc.damage[tokenId] = {};
        }
        for (const [cond, delta] of Object.entries(mods)) {
            if (!T20Npc.DAMAGE_CONDITIONS.includes(cond)) { continue; }
            let newVal = (state.t20npc.damage[tokenId][cond] || 0) + delta;
            if (newVal < 0) {
                newVal = 0;
            }
            // adjust boolean conditions to be either 0 or 1
            if ((T20Npc.BOOLEAN_CONDITIONS.includes(cond)) && (newVal != 0)) {
                newVal = 1;
            }
            state.t20npc.damage[tokenId][cond] = newVal;
        }
    },

    // make an attack roll with the specified weapon
    rollAttack: function(tokenId, n) {
        let token = getObj("graphic", tokenId);
        if ((!token) || (!token.get("represents"))) { return; }
        let character = getObj("character", token.get("represents"));
        if ((!character) || (!character.get("name"))) { return; }
        let charName = character.get("name");
        let name = token.get("name") || charName;
        if ((n || 0) <= 0) {
            n = 1;
        }
        n -= 1;  // adjust for 0-based index
        let pref = `repeating_weapons_\$${n}_`;
        let msg = `&{template:True20Attack} {{name=${name}}} {{subtags=attacks with a @{${charName}|${pref}weap_name} }}`;
        msg += ` {{attack1=[[1d20cs>@{${charName}|${pref}weap_crit} + @{${charName}|${pref}weap_type}[attack] + @{${charName}|${pref}weap_hit_mod}[weapon]`;
        let crit = `{{critconfirm1=[[1d20cs>@{${charName}|${pref}weap_crit} + @{${charName}|${pref}weap_type}[attack] + @{${charName}|${pref}weap_hit_mod}[weapon]`;
        if ((state.t20npc.damage.hasOwnProperty(tokenId)) && ((state.t20npc.damage[tokenId].wounded || 0) > 0)) {
            msg += " - 2[shaken]";
            crit += " - 2[shaken]";
        }
        msg += ` ]]}} ${crit} ]]}}`;
        sendChat(name, msg);
        msg = `&{template:True20Generic} {{name=${name}}}`;
        msg += ` {{damage=+[[@{${charName}|${pref}weap_dmg}[base] + @{${charName}|${pref}weap_dmg_abil}[abil] + @{${charName}|${pref}weap_dmg_mod}[weapon] ]] @{${charName}|${pref}weap_dmg_type} }}`;
        msg += ` {{critdamage=+[[@{${charName}|${pref}weap_crit_dmg}]]}} {{notes=@{${charName}|${pref}weap_note} }}`;
        sendChat(name, `/w gm ${msg}`);
    },

    // roll a grapple check
    rollGrapple: function(tokenId) {
        let token = getObj("graphic", tokenId);
        if ((!token) || (!token.get("represents"))) { return; }
        let character = getObj("character", token.get("represents"));
        if ((!character) || (!character.get("name"))) { return; }
        let charName = character.get("name");
        let name = token.get("name") || charName;
        let msg = `&{template:True20Generic} {{name=${name}}} {{subtags=Grapple Check}} {{Result=[[1d20 + @{${charName}|grapple}[grapple]`;
        if ((state.t20npc.damage.hasOwnProperty(tokenId)) && ((state.t20npc.damage[tokenId].wounded || 0) > 0)) {
            msg += " - 2[shaken]";
        }
        msg += " ]]}}";
        sendChat(name, msg);
    },

    // roll a saving throw
    rollSave: function(tokenId, save) {
        if (!T20Npc.SAVE_NAMES.hasOwnProperty(save)) { return; }
        let saveName = T20Npc.SAVE_NAMES[save];
        let token = getObj("graphic", tokenId);
        if ((!token) || (!token.get("represents"))) { return; }
        let character = getObj("character", token.get("represents"));
        if ((!character) || (!character.get("name"))) { return; }
        let charName = character.get("name");
        let name = token.get("name") || charName;
        let msg = `&{template:True20Generic} {{name=${name}}} {{subtags=${saveName} Save}} {{Result=[[1d20 + @{${charName}|${save}}[${save}]`;
        if ((state.t20npc.damage.hasOwnProperty(tokenId)) && ((state.t20npc.damage[tokenId].wounded || 0) > 0)) {
            msg += " - 2[shaken]";
        }
        msg += ` ]]}} {{notes=@{${charName}|${save}_note} }}`;
        sendChat(name, msg);
    },

    // roll a skill check
    rollSkill: function(tokenId, skill) {
        if (!T20Npc.SKILL_NAMES.hasOwnProperty(skill)) { return; }
        let skillName = T20Npc.SKILL_NAMES[skill];
        let token = getObj("graphic", tokenId);
        if ((!token) || (!token.get("represents"))) { return; }
        let character = getObj("character", token.get("represents"));
        if ((!character) || (!character.get("name"))) { return; }
        let charName = character.get("name");
        let name = token.get("name") || charName;
        let msg = `&{template:True20Generic} {{name=${name}}} {{subtags=${skillName} Check}} {{Result=[[1d20cf<0cs>99 + @{${charName}|skill_${skill}}[skill]`;
        if ((state.t20npc.damage.hasOwnProperty(tokenId)) && ((state.t20npc.damage[tokenId].wounded || 0) > 0)) {
            msg += " - 2[shaken]";
        }
        msg += ` ]]}} {{notes=@{${charName}|skill_${skill}_note} }}`;
        sendChat(name, msg);
    },

    showHelp: function() {
        function write(s) {
            s = s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
            s = `/w gm <div style="white-space: pre-wrap; padding: 0px; margin: 0px">${s}</div>`;
            sendChat("T20NPC", s);
        }

        write("!t20npc <command> [args]");
        write("\tUtilities for True20 NPC tokens");
        write("!t20npc clear");
        write("\tClear all stored damage");
        write("!t20npc status");
        write("\tShow damage status of the selected NPC token");
        write("!t20npc toughness [-n|--nonlethal] [dc]");
        write("\tRoll a toughness save for the selected NPC token");
        write("\t-n|--nonlethal: save vs. nonlethal damage");
        write("\tdc: apply damage based on given toughness save DC");
        write("!t20npc damage <condition>");
        write("\tApply specified damage to selected NPC token");
        write("\tUpgrades and spills damage as necessary");
        write("!t20npc heal [n]");
        write("\tHeal the worst n damage conditions of selected NPC token");
        write("\tn defaults to 1");
        write("!t20npc dmgmod <condition> <n>");
        write("\tModify damage conditions for selected NPC token");
        write("\tAdds n to the count of specified condition");
        write("\tMay specify multiple (<condition> <n>) pairs");
        write("!t20npc attack <weapon #>");
        write("\tMake an attack roll with the specified weapon");
        write("!t20npc grapple");
        write("\tRoll a grapple check for the selected NPC token");
        write("!t20npc save <fort|fortitude|ref|reflex|will>");
        write("\tRoll a saving throw for the selected NPC token");
        write("!t20npc skill <skill>");
        write("\tRoll a skill check for the selected NPC token");
    },

    handleClearCommand: function(args, selected) {
        T20Npc.clearDamage();
    },

    handleStatusCommand: function(args, selected) {
        if ((!selected) || (selected.length <= 0)) { return; }
        for (const token of selected) {
            T20Npc.displayDamage(token._id);
        }
    },

    handleToughnessCommand: function(args, selected) {
        if ((!selected) || (selected.length <= 0)) { return; }
        let lethal = true, dc = null;
        if ((args.length > 0) && ((args[0] == "-n") || (args[0] == "--nonlethal"))) {
            lethal = false;
            args.shift();
        }
        if (args.length > 0) {
            dc = parseInt(args[0]);
        }
        for (const token of selected) {
            T20Npc.rollToughness(token._id, lethal, dc);
        }
    },

    handleDamageCommand: function(args, selected) {
        if ((args.length < 1) || (!selected) || (selected.length <= 0)) { return; }
        for (const token of selected) {
            T20Npc.addDamage(token._id, args[0]);
        }
    },

    handleHealCommand: function(args, selected) {
        if ((!selected) || (selected.length <= 0)) { return; }
        let n = 1;
        if (args.length >= 1) {
            n = parseInt(args[0]);
        }
        for (const token of selected) {
            T20Npc.healDamage(token._id, n);
        }
    },

    handleDmgModCommand: function(args, selected) {
        if ((args.length < 2) || (!selected) || (selected.length <= 0)) { return; }
        let mods = {};
        for (let i = 0; i < args.length - 1; i += 2) {
            let cond = args[i].toLowerCase();
            mods[cond] = (mods[cond] || 0) + parseInt(args[i + 1]);
        }
        for (const token of selected) {
            T20Npc.modifyDamage(token._id, mods);
        }
        sendChat("T20NPC", "/w gm Damage modified.");
    },

    handleAttackCommand: function(args, selected) {
        if ((!selected) || (selected.length <= 0)) { return; }
        let n = 1;
        if (args.length >= 1) {
            n = parseInt(args[0]);
        }
        for (const token of selected) {
            T20Npc.rollAttack(token._id, n);
        }
    },

    handleGrappleCommand: function(args, selected) {
        if ((!selected) || (selected.length <= 0)) { return; }
        for (const token of selected) {
            T20Npc.rollGrapple(token._id);
        }
    },

    handleSaveCommand: function(args, selected) {
        if ((args.length < 1) || (!selected) || (selected.length <= 0)) { return; }
        let save = args[0].toLowerCase();
        if (save == "reflex") {
            save = "ref";
        }
        else if (save == "fortitude") {
            save = "fort";
        }
        for (const token of selected) {
            T20Npc.rollSave(token._id, save);
        }
    },

    handleSkillCommand: function(args, selected) {
        if ((args.length < 1) || (!selected) || (selected.length <= 0)) { return; }
        let skill = args[0].toLowerCase();
        if (!T20Npc.SKILL_NAMES.hasOwnProperty(skill)) {
            // TODO: handle craft, knowledge, and perform specializations
            let skillName = args.join(" ");
            if (!T20Npc.SKILLS_BY_NAME.hasOwnProperty(skillName)){ return; }
            skill = T20Npc.SKILLS_BY_NAME[skillName];
        }
        for (const token of selected) {
            T20Npc.rollSkill(token._id, skill);
        }
    },

    handleTurnChange: function(newTurnOrder, oldTurnOrder) {
        let newTurns = JSON.parse((typeof(newTurnOrder) == typeof("") ? newTurnOrder : newTurnOrder.get("turnorder") || "[]"));
        if ((!newTurns) || (newTurns.length <= 0)) { return; }
        if (!state.t20npc.damage.hasOwnProperty(newTurns[0].id)) { return; }
        T20Npc.displayDamage(newTurns[0].id);
    },

    handleChatMessage: function(msg) {
        if ((msg.type != "api") || (msg.content.indexOf("!t20npc ") != 0)) { return; }

        let args = msg.content.split(/\s+/);
        if ((args.length < 2) || (args[1] == "help")) {
            T20Npc.showHelp();
            return;
        }
        args.shift();
        let command = args.shift();

        switch (command) {
        case "clear":
            T20Npc.handleClearCommand(args, msg.selected);
            break;
        case "status":
            T20Npc.handleStatusCommand(args, msg.selected);
            break;
        case "toughness":
            T20Npc.handleToughnessCommand(args, msg.selected);
            break;
        case "damage":
            T20Npc.handleDamageCommand(args, msg.selected);
            break;
        case "heal":
            T20Npc.handleHealCommand(args, msg.selected);
            break;
        case "dmgmod":
            T20Npc.handleDmgModCommand(args, msg.selected);
            break;
        case "attack":
            T20Npc.handleAttackCommand(args, msg.selected);
            break;
        case "grapple":
            T20Npc.handleGrappleCommand(args, msg.selected);
            break;
        case "save":
            T20Npc.handleSaveCommand(args, msg.selected);
            break;
        case "skill":
            T20Npc.handleSkillCommand(args, msg.selected);
            break;
        }
    },

    registerT20Npc: function() {
        if (!state.hasOwnProperty("t20npc")) {
            state.t20npc = {};
        }
        if (!state.t20npc.hasOwnProperty("damage")) {
            state.t20npc.damage = {};
        }
        for (const [skillId, skillName] of Object.entries(T20Npc.SKILL_NAMES)) {
            T20Npc.SKILLS_BY_NAME[skillName] = skillId;
        }
        for (let i = 1; i <= 3; i++) {
            T20Npc.SKILL_NAMES[`craft${i}`] = "Craft";
            T20Npc.SKILL_NAMES[`know${i}`] = "Knowledge";
            T20Npc.SKILL_NAMES[`perf${i}`] = "Perform";
        }

	on("change:campaign:turnorder", T20Npc.handleTurnChange);
        on("chat:message", T20Npc.handleChatMessage);
    }
};

on("ready", function(){ T20Npc.registerT20Npc(); });
