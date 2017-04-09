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
    container: ['listblock', 'table', 'quote', 'hr'],

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

function ParseSingle(text, allowedModes, h) {
    var p = Parser_GetModes();
    var input = text;
    
    while (input.length) {
        // find closest match from modes.
        var firstMode = null;
        var firstMatch = null;
        p.forEach(function(mode) {
            if (allowedModes !== void 0 && allowedModes.indexOf(allowedModes) === -1)
                return;
            mode = Syntax[mode];
            if (mode.enter === void 0 || mode.leave === void 0)
                return;
            var match = input.match(mode.enter);
            if (match) {
                if (!firstMatch || match.index < firstMatch.index) {
                    firstMatch = match;
                    firstMode = mode;
                }
            }
        });

        if (firstMatch && firstMode) {
            var before = input.substr(0, firstMatch.index);
            var after = input.substr(before.length+firstMatch[0].length);

            if (firstMode.leave !== void 0) {
                var exitMatch = after.match(firstMode.leave);
                if (!exitMatch) // exit not found... that's bad?
                {
                    Syntax['base'].process(before+firstMatch[0], DOKU_LEXER_UNMATCHED, h.pos, h);
                    h.pos += before+firstMatch[0].length;
                    input = after;
                    continue;
                }
                
                if (before.length) {
                    Syntax['base'].process(before, DOKU_LEXER_UNMATCHED, h.pos, h);
                    h.pos += before.length;
                }
                
                firstMode.process(firstMatch[0], DOKU_LEXER_ENTER, h.pos, h);
                h.pos += firstMatch[0].length;
                var inner = input.substr(before.length+firstMatch[0].length, exitMatch.index);
                firstMode.process(inner, DOKU_LEXER_UNMATCHED, h.pos, h);
                h.pos += inner.length;
                firstMode.process(exitMatch[0], DOKU_LEXER_EXIT, h.pos, h);
                h.pos += exitMatch[0].length;
                input = input.substr(before.length+firstMatch[0].length+inner.length+exitMatch[0].length);
            } else {
                if (before.length) {
                    Syntax['base'].process(before, DOKU_LEXER_UNMATCHED, h.pos, h);
                    h.pos += before.length;
                }
                
                firstMode.process(firstMatch[0], DOKU_LEXER_SPECIAL, h.pos, h);
                h.pos += firstMatch[0].length;
                input = input.substr(before.length+firstMatch[0].length);
            }
        }else {
            Syntax['base'].process(input, DOKU_LEXER_UNMATCHED, h.pos, h);
            input = ''; // break
        }
    }
}

function Parse(text) {
    var h = Parser_Handler();
    h.pos = 0;
    ParseSingle(text, void 0, h);
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