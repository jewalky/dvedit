/**
 * Created by ZZYZX on 05/03/2017.
 * Here the syntax parser is contained. This mostly duplicates dokuwiki's own parser.
 * Author of the original code is Harry Fuecks, sometimes Andreas Gohr. for details see parser.php/parserutils.php.
 * Unlike the original parser, this one is a bit more direct and translates to HTML instead of instructions then possibly HTML.
 * Note: requires lexer.js, syntax.js
 */

/* we don't really use an interface here, just document the required fields. */
/**
 * {
 *  getSort: function() -> number
 *  preConnect: function()
 *  connectTo: function()
 *  postConnect: function()
 *  accepts: function() -> bool
 * }
 */

const DOKU_LEXER_ENTER = 0;
const DOKU_LEXER_EXIT = 1;
const DOKU_LEXER_UNMATCHED = 2;
const DOKU_LEXER_SPECIAL = 3;
 
/**
 * Define various types of modes used by the parser - they are used to
 * populate the list of modes another mode accepts
 */
const PARSER_MODES = {
    // containers are complex modes that can contain many other modes
    // hr breaks the principle but they shouldn't be used in tables / lists
    // so they are put here
    container: ['listblock', 'table', 'tablecell', 'quote', 'hr', 'paragraph'],

    // some mode are allowed inside the base mode only
    baseonly: ['header'],

    // modes for styling text -- footnote behaves similar to styling
    formatting: ['strong', 'emphasis', 'underline', 'monospace',
        'subscript', 'superscript', 'deleted', 'footnote'],

    // modes where the token is simply replaced - they can not contain any
    // other modes
    substition: ['acronym', 'smiley', 'wordblock', 'entity',
        'camelcaselink', 'internallink', 'media',
        'externallink', 'linebreak', 'emaillink',
        'windowssharelink', 'filelink', 'notoc',
        'nocache', 'multiplyentity', 'quotes', 'rss'],

    // modes which have a start and end token but inside which
    // no other modes should be applied
    protected: ['preformatted', 'code', 'file', 'php', 'html', 'htmlblock', 'phpblock'],

    // inside this mode no wiki markup should be applied but lineendings
    // and whitespace isn't preserved
    disabled: ['unformatted'],

    // used to mark paragraph boundaries
    paragraphs: ['eol']
};

function ParseSingle(text, h) {
    var p = Parser_GetModes();
    var input = text;
    
    var modeStack = ['base'];
    var inputStack = [];
    
    // reset syntaxes
    var stx = Object.getOwnPropertyNames(Syntax);
    stx.forEach(function(stx) { if (typeof(Syntax[stx].parserInit)==='function') Syntax[stx].parserInit(); });
    
    while (input.length) {
        var baseMode = Syntax[modeStack[modeStack.length-1]];
        var allowedModes = baseMode.allowedModes;
        // find closest match from modes.
        var exitMatch = null;
        if (baseMode.leave !== void 0) {
            exitMatch = input.match(baseMode.leave);
        }
        
        var inMatch = null;
        if (baseMode.pattern !== void 0) {
            inMatch = input.match(baseMode.pattern);
        }

        var firstModeName = null;
        var firstMode = null;
        var firstMatch = null;
        p.forEach(function(mode) {
            if (allowedModes !== void 0 && allowedModes.indexOf(mode) === -1)
                return;
            var modeName = mode;
            mode = Syntax[mode];
            if (mode.enter === void 0 || !!mode.manual)
                return;
            var match = input.match(mode.enter);
            if (match) {
                if (!firstMatch || match.index < firstMatch.index) {
                    firstMatch = match;
                    firstMode = mode;
                    firstModeName = modeName;
                }
            }
        });
        
        // if we are leaving the base mode.
        if (exitMatch && (!firstMatch || firstMatch.index > exitMatch.index) && (!inMatch || inMatch.index > exitMatch.index)) {
            var before = input.substr(0, exitMatch.index);
            if (before.length) {
                baseMode.process(before, DOKU_LEXER_UNMATCHED, h.pos, h);
                h.pos += before.length;
            }
            baseMode.process(exitMatch[0], DOKU_LEXER_EXIT, h.pos, h, inputStack[inputStack.length-1]);
            h.pos += exitMatch[0].length;
            input = input.substr(before.length+exitMatch[0].length);
            modeStack = modeStack.slice(0, modeStack.length-1);
            inputStack = inputStack.slice(0, inputStack.length-1);
            continue;
        }
        
        // if we found additional patterns for the base mode.
        if (inMatch && (!firstMatch || firstMatch.index > inMatch.index)) {
            var before = input.substr(0, inMatch.index);
            if (before.length) {
                baseMode.process(before, DOKU_LEXER_UNMATCHED, h.pos, h);
                h.pos += before.length;
            }
            baseMode.process(inMatch[0], DOKU_LEXER_SPECIAL, h.pos, h);
            h.pos += inMatch[0].length;
            input = input.substr(before.length+inMatch[0].length);
            continue;
        }
        
        if (firstMatch && firstMode) {
            var before = input.substr(0, firstMatch.index);
            var after = input.substr(before.length+firstMatch[0].length);

            if (firstMode.leave !== void 0) {
                //console.log('enter', firstMatch);
                if (before.length) {
                    baseMode.process(before, DOKU_LEXER_UNMATCHED, h.pos, h);
                    h.pos += before.length;
                }
                
                var d = firstMode.process(firstMatch[0], DOKU_LEXER_ENTER, h.pos, h);
                inputStack.push(d);
                h.pos += firstMatch[0].length;
                input = input.substr(before.length+firstMatch[0].length);
                modeStack.push(firstModeName);
            } else {
                //console.log('special', firstMatch);
                if (before.length) {
                    baseMode.process(before, DOKU_LEXER_UNMATCHED, h.pos, h);
                    h.pos += before.length;
                }
                
                firstMode.process(firstMatch[0], DOKU_LEXER_SPECIAL, h.pos, h);
                h.pos += firstMatch[0].length;
                input = input.substr(before.length+firstMatch[0].length);
            }
        } else {
            baseMode.process(input, DOKU_LEXER_UNMATCHED, h.pos, h);
            input = ''; // break
        }
    }
}

function Parse(text) {
    var h = Parser_Handler();
    h.pos = 0;
    ParseSingle(text, h);
    h._finalize();
    return h.output;
}

function Parser_GetDVAttrsFromNode(node) {
    var attrs = {};
    if (!node || !node.getAttribute) return attrs;
    
    attrs.type = node.getAttribute('dv-type');
    attrs.start = node.getAttribute('dv-start');
    attrs.end = node.getAttribute('dv-end');
    attrs.cstart = node.getAttribute('dv-cstart');
    attrs.cend = node.getAttribute('dv-cend');
    if (attrs.start !== null) attrs.start *= 1;
    else attrs.start = void 0;
    if (attrs.end !== null) attrs.end *= 1;
    else attrs.end = void 0;
    if (attrs.cstart !== null) attrs.cstart *= 1;
    else attrs.cstart = void 0;
    if (attrs.cend !== null) attrs.cend *= 1;
    else attrs.cend = void 0;
    if (attrs.type === null) attrs.type = void 0;

    return attrs;
}