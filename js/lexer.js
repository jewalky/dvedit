/**
 * Created by ZZYZX on 05/03/2017.
 * this somewhat duplicates DokuWiki's Doku_Lexer and related structures.
 * original code by Marcus Baker. for details see lexer.php.
 */

const DOKU_LEXER_ENTER = 1;
const DOKU_LEXER_MATCHED = 2;
const DOKU_LEXER_UNMATCHED = 3;
const DOKU_LEXER_EXIT = 4;
const DOKU_LEXER_SPECIAL = 5;



function LexerParallelRegex(c) {

    this._case = c;
    this._patterns = [];
    this._labels = [];
    this._regex = null;

}

// takes: pattern (regex or string)
//        label (true or string)
LexerParallelRegex.prototype.addPattern = function(pattern, label) {
    if (label === void 0)
        label = true;

    this._patterns.push(this._getRegExpString(pattern));
    this._labels.push(label);
    this._regex = null;
};

// takes: subject (string)
//        match (array)
// writes first regex match to match[0]
LexerParallelRegex.prototype.match = function(subject, match) {
    if (match === void 0)
        return false;

    match.length = 1;
    match[0] = '';

    if (!this._patterns.length)
        return false;

    var matches = subject.match(this._getCompoundedRegex());
    if (!matches)
        return false;

    match[0] = matches[0];
    for (var i = 1; i < matches.length; i++) {
        if (matches[i] && this._labels[i-1] !== void 0)
            return this._labels[i-1];
    }

    return true;
};

// takes: subject (string)
//        split (array)
// writes results into split
LexerParallelRegex.prototype.split = function(subject, split) {
    if (split === void 0)
        return false;

    split.length = 3;
    split[0] = subject;
    split[1] = '';
    split[2] = '';

    if (!this._patterns.length)
        return false;

    subject = subject.replace(/\n/g, '\u0001'); // this is for JS' retarded regex parser that doesn't have multiline flag...
    
    var matches = subject.match(this._getCompoundedRegex());
    if (!matches) {
        return false;
    }

    for (var i = 0; i < matches.length; i++) {
        if (typeof(matches[i])==='string')
            matches[i] = matches[i].replace(/\x01/g, '\n');
    }
    
    var idx = matches.length-2;
    var prePost = subject.split(new RegExp(this._patterns[idx], this._getPerlMatchingFlags()), 2);
    
    split[0] = prePost[0].replace(/\x01/g, '\n');
    split[1] = matches[0];
    split[2] = prePost.length>1?prePost[1].replace(/\x01/g, '\n'):'';

    if (this._labels[idx] !== void 0)
        return this._labels[idx];
    return true;
};

//
LexerParallelRegex.prototype._getCompoundedRegex = function() {
    /*'1 2 3 4'.match(/\d/g);
     ["1", "2", "3", "4"]*/

    if (!this._regex) {
        for (var i = 0; i < this._patterns.length; i++) {
            var elts_regex = new RegExp('\\\\.|' +
                '\\(\\?|' +
                '[()]|' +
                '\\[\\^?\\]?(?:\\\\.|\\[:[^]]*:\\]|[^]\\\\])*\\]|' +
                '[^[()\\\\]+', 'g');
            var patternStr = this._patterns[i].toString();
            var elts = patternStr.match(elts_regex);

            var pattern = '';
            var level = 0;

            for (var j = 0; j < elts.length; j++) {
                var elt = elts[j];
                switch (elt) {
                    case '(':
                        pattern += '\\(';
                        break;
                    case ')':
                        if (level > 0)
                            level--; // closing (?
                        else pattern += '\\';
                        pattern += ')';
                        break;
                    case '(?':
                        level++;
                        pattern += '(?';
                        break;
                    default:
                        if (elt[0] === '\\')
                            pattern += elt;
                        else pattern += elt.replace(/\//g, '\\/');
                        break;
                }
            }

            this._patterns[i] = '('+pattern+')';
        }

        this._regex = new RegExp(this._patterns.join('|'), this._getPerlMatchingFlags());
    }

    return this._regex;
};

LexerParallelRegex.prototype._getPerlMatchingFlags = function() {
    return (this._case) ? 'm' : 'mi';
};

LexerParallelRegex.prototype._getRegExpObject = function(s) {
    if (typeof(s) === 'string') {
        var flags = s.replace(/.*\/([gimysS]*)$/, '$1');
        var pattern = s.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
        return new RegExp(pattern, flags);
    } else {
        return s; // already regexp.
    }
};

LexerParallelRegex.prototype._getRegExpString = function(s) {
    if (typeof(s) === 'string') {
        return s;
    } else {
        s = s.toString();
        var flags = s.replace(/.*\/([gimy]*)$/, '$1');
        var pattern = s.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
        return pattern;
    }
}


//////

function LexerStateStack(start) {
    this._stack = [start];
}

LexerStateStack.prototype.getCurrent = function() {
    return this._stack[this._stack.length-1];
};

LexerStateStack.prototype.enter = function(state) {
    this._stack.push(state);
};

LexerStateStack.prototype.leave = function() {
    if (this._stack.length == 1)
        return false;
    this._stack.length--;
    return true;
};


//////

function Lexer(parser, start, c) {

    if (start === void 0)
        start = 'accept';
    if (c === void 0)
        c = false;

    this._case = c;
    this._regexes = {};
    this._parser = parser;
    this._mode = new LexerStateStack(start);
    this._mode_handlers = [];

}

Lexer.prototype.addPattern = function(pattern, mode) {
    if (mode === void 0)
        mode = 'accept';
    if (!this._regexes[mode])
        this._regexes[mode] = new LexerParallelRegex(this._case);
    this._regexes[mode].addPattern(pattern);
}

Lexer.prototype.addEntryPattern = function(pattern, mode, new_mode) {
    if (!this._regexes[mode])
        this._regexes[mode] = new LexerParallelRegex(this._case);
    this._regexes[mode].addPattern(pattern, new_mode);
}

Lexer.prototype.addExitPattern = function(pattern, mode) {
    if (!this._regexes[mode])
        this._regexes[mode] = new LexerParallelRegex(this._case);
    this._regexes[mode].addPattern(pattern, '__exit');
}

Lexer.prototype.addSpecialPattern = function(pattern, mode, special) {
    if (!this._regexes[mode])
        this._regexes[mode] = new LexerParallelRegex(this._case);
    this._regexes[mode].addPattern(pattern, '_'+special);
}

Lexer.prototype.mapHandler = function(mode, handler) {
    this._mode_handlers[mode] = handler;
}

Lexer.prototype.parse = function(raw) {
    if (!this._parser)
        return false;

    raw = [raw]; // to 'pass by reference'
    var initialLength = raw[0].length;
    var length = initialLength;
    var pos = 0;
    var parsed;
    while(Array.isArray(parsed = this._reduce(raw))) {
        var unmatched = parsed[0];
        var matched = parsed[1];
        var mode = parsed[2];
        var currentLength = raw[0].length;
        var matchPos = initialLength - currentLength - matched.length;
        if (!this._dispatchTokens(unmatched, matched, mode, pos, matchPos))
            return false;
        if (currentLength === length)
            return false;
        length = currentLength;
        pos = initialLength - currentLength;
    }
    if (!parsed)
        return false;
    return this._invokeParser(raw[0], DOKU_LEXER_UNMATCHED, pos);
};

Lexer.prototype._dispatchTokens = function(unmatched, matched, mode, initialPos, matchPos) {
    if (mode === void 0)
        mode = false;
    if (!this._invokeParser(unmatched, DOKU_LEXER_UNMATCHED, initialPos))
        return false;
    if (this._isModeEnd(mode)) {
        if (!this._invokeParser(matched, DOKU_LEXER_EXIT, matchPos))
            return false;
        return this._mode.leave();
    }
    if (this._isSpecialMode(mode)) {
        this._mode.enter(this._decodeSpecial(mode));
        if (!this._invokeParser(matched, DOKU_LEXER_SPECIAL, matchPos))
            return false;
        return this._mode.leave();
    }
    if (typeof(mode) === 'string') {
        this._mode.enter(mode);
        return this._invokeParser(matched, DOKU_LEXER_ENTER, matchPos);
    }
    return this._invokeParser(matched, DOKU_LEXER_MATCHED, matchPos);
};

Lexer.prototype._isModeEnd = function(mode) {
    return (mode === '__exit');
};

Lexer.prototype._isSpecialMode = function(mode) {
    return (mode[0] === '_');
};

Lexer.prototype._decodeSpecial = function(mode) {
    return mode.substring(1);
};

Lexer.prototype._invokeParser = function(content, isMatch, pos) {
    if (content === '' || content === false)
        return true;
    var handler = this._mode.getCurrent();
    if (this._mode_handlers[handler])
        handler = this._mode_handlers[handler];
    //
    var cls = Syntax[handler];
    if (handler.startsWith('plugin_')) {
        var handlerSplit = handler.split('_', 2);
        handler = handlerSplit[0];
        var plugin = handlerSplit[1];
        return cls.process(content, isMatch, pos, plugin, this._parser);
    }
    return cls.process(content, isMatch, pos, this._parser);
};

Lexer.prototype._reduce = function(raw) {
    var rawStr = raw[0];
    if (!this._regexes[this._mode.getCurrent()])
        return false;
    if (rawStr === '')
        return true;
    var action;
    var split = [];
    if (action = this._regexes[this._mode.getCurrent()].split(rawStr, split)) {
        raw[0] = raw[0].substring(split[0].length+split[1].length); // note: dokuwiki would do it differently, but it doesn't work that way for me
        return [split[0], split[1], action];
    }
    return true;
};

Lexer.escape = function(str) {
    var chars = [
        '\\\\',
        '\\.',
        '\\+',
        '\\*',
        '\\?',
        '\\[',
        '\\^',
        '\\]',
        '\\$',
        '\\{',
        '\\}',
        '\\=',
        '\\!',
        '\\<',
        '\\>',
        '\\|',
        '\\:'
    ];

    var escaped = [
        '\\\\\\\\',
        '\\.',
        '\\+',
        '\\*',
        '\\?',
        '\\[',
        '\\^',
        '\\]',
        '\\$',
        '\\{',
        '\\}',
        '\\=',
        '\\!',
        '\\<',
        '\\>',
        '\\|',
        '\\:'
    ];

    for (var i = 0; i < chars.length; i++) {
        str = str.replace(new RegExp(chars[i], 'g'), escaped[i]);
    }

    return str;
};
