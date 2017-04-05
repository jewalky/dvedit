/**
 * Created by ZZYZX on 05/03/2017.
 * This file defines the syntax that's supported.
*/

// "h" parameter for process functions is the object returned by Parser_Handler().
const DeleteType_Overlapping = 0;
const DeleteType_Empty = 1;
const DeleteType_Never = 2;

const Syntax = {
    base: {
        allowedModes: PARSER_MODES.container
                .concat(PARSER_MODES.baseonly)
                .concat(PARSER_MODES.paragraphs)
                .concat(PARSER_MODES.formatting)
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.protected)
                .concat(PARSER_MODES.disabled),
        sort: 0,
        
        process: function(match, state, pos, h) {
            switch (state) {
                case DOKU_LEXER_UNMATCHED:
                    h.output += h._makeParagraphs(match, pos);
                    return true;
            }
        }
    },
    
    // this is not used directly, but specifies element style.
    paragraph: {
        
    },
    
    linebreak: {
        sort: 140,
        connectTo: function(mode) {
            this.Lexer.addSpecialPattern(/\x5C{2}(?:[\s\t]|(?=\n))/, mode, 'linebreak');
        },
        
        process: function(match, state, pos, h) {
            h.output += '<br '+h._getDVAttrs(pos, pos+match.length, void 0, void 0, 'linebreak')+'>';
            return true;
        },
        
        deleteType: DeleteType_Overlapping
    }
};
 
// these are all utility functions to help moving away from DW PHP-style parser
// list of supported modes. 
function Parser_GetModes() {
    return ['listblock','preformatted','notoc','nocache',
        'header','table','linebreak','footnote','hr',
        'unformatted','php','html','code','file','quote',
        'internallink','rss','media','externallink',
        'emaillink','windowssharelink','eol'];
}

function Parser_CreateMode(name) {
    const cls = Syntax[name];
    if (!cls) return null;
    
    const obj = Parser_Mode();
    
    if (cls.connectTo)
        obj.connectTo = cls.connectTo;
    if (cls.sort !== void 0)
        obj.getSort = function() { return cls.sort; }
    if (cls.preConnect)
        obj.preConnect = cls.preConnect;
    if (cls.postConnect)
        obj.postConnect = cls.postConnect;
    if (cls.accepts)
        obj.accepts = cls.accepts;
    if (cls.init)
    {
        obj.init = cls.init;
        obj.init();
    }
    if (cls.allowedModes)
        obj.allowedModes = cls.allowedModes;
    
    return obj;
}

function Parser_GetMode(name) {
    const obj = Parser_CreateMode(name);
    if (!obj) return null;
    
    return {
        sort: obj.getSort(),
        mode: name,
        obj: obj
    };
}
 
// base "constructor"
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

// main parser handler.
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
            var outS = this.output.split('\n\n');
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
                pos += outS[i].length+2;
            }
            this.output = output;
        },

        // this function remembers source positions for unmatched multiline text using spans.
        _makeParagraphs: function(match, basePos) {
            var outS = match.split('\n\n');
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
                s = s.replace(/\n/g, ' ');
                s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace('/&/g', '&amp;').replace('/"/g', '&quot;');
                var newS = '<span ' + this._getDVAttrs(pos, pos + outS[i].length + (isN ? 2 : 0), pos, pos + outS[i].length, 'base') + '>' + s + '</span>';
                output += newS + (isN ? '\n\n' : '');
                pos += outS[i].length+(isN?2:0);
            }
            return output;
        }
    };
}