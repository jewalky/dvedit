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

function Parser() {
    this.Handler = void 0;
    this.Lexer = void 0;
    this.modes = {};
    this.connected = false;
}

Parser.prototype.addBaseMode = function(BaseMode) {
    this.modes['base'] = BaseMode;
    if (!this.Lexer)
        this.Lexer = new Lexer(this.Handler, 'base', true);
    this.modes['base'].Lexer = this.Lexer;
};

Parser.prototype.addMode = function(name, Mode) {
    // note: original function comment says this:
    //     /**
    //      * PHP preserves order of associative elements
    //      * Mode sequence is important
    //      */

    if (!this.modes['base'])
        this.addBaseMode(Parser_CreateMode('base'));
    Mode.Lexer = this.Lexer;
    this.modes[name] = Mode;
};

Parser.prototype.connectModes = function() {
    if (this.connected)
        return;

    const ownProps = Object.getOwnPropertyNames(this.modes);
    for (var i = 0; i < ownProps.length; i++) {
        const mode = ownProps[i];
        if (mode === 'base')
            continue;
        this.modes[mode].preConnect();
        for (var j = 0; j < ownProps.length; j++) {
            const cm = ownProps[j];
            if (this.modes[cm].accepts(mode))
                this.modes[mode].connectTo(cm);
        }
        this.modes[mode].postConnect();
    }

    this.connected = true;
};

Parser.prototype.parse = function(doc) {
    if (this.Lexer) {
        this.connectModes();
        //
        doc = doc.replace(/\r\n/g, '\n');
        doc += '\u200b'; // magic
        this.Lexer.parse(doc);
        this.Handler._finalize();
        return this.Handler.output;
    } else {
        return false;
    }
};

function p_get_parsermodes() {
    const modes = [];
    // currently only support standard modes.
    const std_modes = Parser_GetModes();
    for (var i = 0; i < std_modes.length; i++) {
        var mode = Parser_GetMode(std_modes[i]);
        if (!mode) continue;
        modes.push(mode);
    }
    return modes;
}

function Parse(text) {
    const modes = p_get_parsermodes();
    const parser = new Parser();
    parser.Handler = Parser_Handler(); // this thing is very special
    for (var i = 0; i < modes.length; i++)
        parser.addMode(modes[i].mode, modes[i].obj);
    const p = parser.parse(text);
    return p;
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