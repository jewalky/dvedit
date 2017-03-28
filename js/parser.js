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
        this.addBaseMode(Parser_Mode_base());
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

function Parser_Mode() {
    return {
        Lexer: void 0,
        allowedModes: [],

        getSort: void 0,
        preConnect: function() {},
        connectTo: function(mode) {},
        postConnect: function() {},
        accepts: function(mode) { return this.allowedModes.indexOf(mode) >= 0; }
    };
}

function p_get_parsermodes() {
    const modes = [];
    // currently only support standard modes.
    const std_modes = ['listblock','preformatted','notoc','nocache',
        'header','table','linebreak','footnote','hr',
        'unformatted','php','html','code','file','quote',
        'internallink','rss','media','externallink',
        'emaillink','windowssharelink','eol'];
    for (var i = 0; i < std_modes.length; i++) {
        const cls = 'Parser_Mode_'+std_modes[i];
        if (!window[cls]) continue; // softer handling here. original code would abort I think.
        const obj = window[cls]();
        modes.push({
            sort: obj.getSort(),
            mode: std_modes[i],
            obj: obj
        });
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

function Parser_Mode_base() {
    const pm = Parser_Mode();
    pm.allowedModes = PARSER_MODES.container
        .concat(PARSER_MODES.baseonly)
        .concat(PARSER_MODES.paragraphs)
        .concat(PARSER_MODES.formatting)
        .concat(PARSER_MODES.substition)
        .concat(PARSER_MODES.protected)
        .concat(PARSER_MODES.disabled);
    pm.getSort = function() { return 0; }
    return pm;
}

function Parser_Mode_linebreak() {
    const pm = Parser_Mode();

    pm.connectTo = function(mode) {
        this.Lexer.addSpecialPattern(/\x5C{2}(?:[\s\t]|(?=\n))/, mode, 'linebreak');
    };

    pm.getSort = function() {
        return 140;
    };

    return pm;
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

function Parser_Handler() {
    return {
        output: '',

        _getDVAttrs: function(start, end, cstart, cend, type) {
            var s = '';
            if (start !== void 0)
                s += 'dv-start="'+start+'"';
            if (end !== void 0) {
                if (s.length) s += ' ';
                s += 'dv-end="'+end+'"';
            }
            if (cstart !== void 0) {
                if (s.length) s += ' ';
                s += 'dv-cstart="'+cstart+'"';
            }
            if (cend !== void 0) {
                if (s.length) s += ' ';
                s += 'dv-cend="'+cend+'"';
            }
            if (type !== void 0) {
                if (s.length) s += ' ';
                s += 'dv-type="'+type+'"';
            }
            return s;
        },

        _getDVAttrsFromNodes: function(nodes) {
            var attrs = {};
            attrs.start = attrs.cstart = void 0;
            attrs.end = attrs.cend = void 0;
            for (var i = 0; i < nodes.length; i++) {
                var nodeAttrs = Parser_GetDVAttrsFromNode(nodes[i]);
                if (nodeAttrs.start !== void 0 &&
                    (attrs.start === void 0 || nodeAttrs.start < attrs.start)) attrs.start = nodeAttrs.start;
                if (nodeAttrs.cstart !== void 0 &&
                    (attrs.cstart === void 0 || nodeAttrs.cstart < attrs.cstart)) attrs.cstart = nodeAttrs.cstart;
                if (nodeAttrs.end !== void 0 &&
                    (attrs.end === void 0 || nodeAttrs.end > attrs.end)) attrs.end = nodeAttrs.end;
                if (nodeAttrs.cend !== void 0 &&
                    (attrs.cend === void 0 || nodeAttrs.cend > attrs.cend)) attrs.cend = nodeAttrs.cend;
            }
            return attrs;
        },

        _getDVAttrsFromHTML: function(html) {
            var o = document.createElement('div');
            o.innerHTML = html;
            return this._getDVAttrsFromNodes(o.childNodes);
        },

        _finalize: function() {
            // take output and convert newlines to p's
            var outS = this.output.split('\n');
            var pos = 0;
            var output = '';
            for (var i = 0; i < outS.length; i++) {
                // <p>{inside}</p>
                // <p> is not counted anywhere (it has zero length in source code)
                // </p> is the newline
                // everything in between is content
                //var newS = '<p '+this._getDVAttrs(pos, pos, pos, pos+outS[i].length, 'paragraph')+'>' + outS[i] + '</p>';
                //var newS = '<p>' + outS[i] + '</p>';
                //console.log('for item "%s" attrs = %s', outS[i], JSON.stringify(this._getDVAttrsFromHTML(outS[i])));
                var inAttrs = this._getDVAttrsFromHTML(outS[i]);
                if (!outS[i].length)
                {
                    inAttrs.start = inAttrs.cstart = pos;
                    inAttrs.end = inAttrs.cend = pos;
                }
                var newS = '<p '+this._getDVAttrs(inAttrs.start, inAttrs.end, inAttrs.cstart, inAttrs.cend, 'paragraph')+'>'+outS[i]+'</p>';
                output += newS;
                pos += outS[i].length+1;
            }
            this.output = output;
        },

        // this function remembers source positions for unmatched multiline text using spans.
        _makeParagraphs: function(match, basePos) {
            var outS = match.split('\n');
            var pos = basePos;
            var output = '';
            for (var i = 0; i < outS.length; i++) {
                // <p>{inside}</p>
                // <p> is not counted anywhere (it has zero length in source code)
                // </p> is the newline
                // everything in between is content
                //var inAttrs = this._getDVAttrsFromHTML(outS[i]);
                var isN = (i != outS.length-1) && (outS.length > 1);
                var s = outS[i].replace(/\u200b/g, '');
                var newS = '<span ' + this._getDVAttrs(pos, pos + outS[i].length + (isN ? 1 : 0), pos, pos + outS[i].length, 'base') + '>' + s + '</span>';
                output += newS + (isN ? '\n' : '');
                pos += outS[i].length+(isN?1:0);
            }
            return output;
        },

        base: function(match, state, pos) {
            switch (state) {
                case DOKU_LEXER_UNMATCHED:
                    this.output += this._makeParagraphs(match, pos);
                    return true;
            }
        },

        linebreak: function(match, state, pos) {
            this.output += '<br '+this._getDVAttrs(pos, pos+match.length, void 0, void 0, 'linebreak')+'>';
            return true;
        }
    };
}