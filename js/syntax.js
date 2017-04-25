/**
 * Created by ZZYZX on 05/03/2017.
 * This file defines the syntax that's supported.
*/

// "h" parameter for process functions is the object returned by Parser_Handler().
const DeleteType_Overlapping = 0;
const DeleteType_Empty = 1;
const DeleteType_Never = 2;

const SyntaxFormatting = {
    strong: {
        entry: /\*\*(?=[\s\S]*\*\*)/,
        exit: /\*\*/
    },
    emphasis: {
        entry: /\/\/(?=[\s\S]*\/\/)/,
        exit: /\/\//
    },
    underline: {
        entry: /__(?=[\s\S]*__)/,
        exit: /__/
    },
    deleted: {
        entry: /<del>(?=[\s\S]*<\/del>)/,
        exit: /<\/del>/
    }
};

function Syntax_InsertString(s, pos, what) {
    return s.substr(0, pos)+what+s.substr(pos);
}

function Syntax_Formatting(type) {
    var cobj = {};
    var tpl = SyntaxFormatting[type];
    cobj.allowedModes = PARSER_MODES.formatting.filter(function(e){ return (e !== type); });
    cobj.allowedModes = cobj.allowedModes.concat(PARSER_MODES.substition).concat(PARSER_MODES.disabled);
    cobj.enter = tpl.entry;
    cobj.leave = tpl.exit;
    cobj.deleteType = DeleteType_Empty;
    cobj.process = function(match, state, pos, h, enterData) {
        var tag = {
            emphasis: 'em',
            strong: 'strong',
            underline: 'u',
            deleted: 's'
        }[type];
        switch (state) {
            case DOKU_LEXER_ENTER:
                h.output += '<'+tag+'>';
                return [h.output.length-1, match, pos]; // passed to exit.
            case DOKU_LEXER_EXIT:
                h.output = Syntax_InsertString(h.output, enterData[0], ' '+h._getDVAttrs(enterData[2], pos+match.length, enterData[2]+enterData[1].length, pos, type));
                h.output += '</'+tag+'>';
                break;
            case DOKU_LEXER_UNMATCHED:
                h.output += h._makeParagraphs(match.replace(/\n/g, '\u00A0'), pos);
                break;
        }
    };
    
    var fmt = {
        emphasis: ['//', '//'],
        strong: ['**', '**'],
        underline: ['__', '__'],
        deleted: ['<del>', '</del>']
    }[type];
    cobj.formatStart = fmt[0];
    cobj.formatEnd = fmt[1];
    
    // GUI
    cobj.createControl = function(parent) {
        var dvButton = document.createElement('a');
        dvButton.setAttribute('class', 'dv-panel-button');
        dvButton.setAttribute('href', '#');
        
        var title = {
            emphasis: '<i>I</i>',
            strong: '<b>B</b>',
            underline: '<u>U</u>',
            deleted: '<s>S</s>'
        }[type];
        
        dvButton.innerHTML = title;
        parent.appendChild(dvButton);
        
        document.addEventListener('dv-selectionchange', function(e) {
            if (!DVEdit.isSelectionInEditor())
                return;
            var xNodes = DVEdit.getNodesBySelection(true);
            dvButton.setAttribute('class', 'dv-panel-button');
            for (var i = 0; i < xNodes.length; i++) {
                if (xNodes[i].type === type)
                    dvButton.setAttribute('class', 'dv-panel-button dv-panel-button-active');
            }
        });
        
        dvButton.addEventListener('click', function(e) {
            var active = dvButton.getAttribute('class').indexOf('dv-panel-button-active')!==-1;
            
            if (DVEdit.isMultiSelection())
            {
                if (active)
                {
                    DVEdit.removeTagInSelection(type);
                }
                else
                {
                    DVEdit.addTagInSelection(type);
                }
            }
            else
            {
                DVEdit.nextAdd(active?-1:1, type); // -1 = remove, 1 = add
                dvButton.setAttribute('class', 'dv-panel-button'+((active)?'':' dv-panel-button-active'));
            }
            
            DVEdit.Control.focus();
            
            e.preventDefault();
            return false;
        });
    };
    
    return cobj;
}

// this specifies the buttons that are available for syntax.
const SyntaxControls = [
    ['strong', 'emphasis', 'underline', 'deleted']
];

// this specifies syntax handlers.
const Syntax = {
    base: {
        allowedModes: PARSER_MODES.container
                .concat(PARSER_MODES.baseonly)
                .concat(PARSER_MODES.paragraphs)
                .concat(PARSER_MODES.formatting)
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.protected)
                .concat(PARSER_MODES.disabled),
        
        process: function(match, state, pos, h) {
            switch (state) {
                case DOKU_LEXER_UNMATCHED:
                    h.output += h._makeParagraphs(match, pos);
                    break;
            }
        }
    },
    
    // this is not used directly, but specifies element style.
    paragraph: {
        
    },
    
    linebreak: {
        allowedModes: PARSER_MODES.container
                .concat(PARSER_MODES.baseonly)
                .concat(PARSER_MODES.paragraphs)
                .concat(PARSER_MODES.formatting)
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.protected)
                .concat(PARSER_MODES.disabled),
                
        enter: /\x5C{2}(?:[\s\t]|(?=\n))/,
        
        process: function(match, state, pos, h) {
            h.output += '<br '+h._getDVAttrs(pos, pos+match.length, void 0, void 0, 'linebreak')+'>';
        },
        
        deleteType: DeleteType_Overlapping
    },
    
    strong: Syntax_Formatting('strong'),
    emphasis: Syntax_Formatting('emphasis'),
    underline: Syntax_Formatting('underline'),
    deleted: Syntax_Formatting('deleted')
};
 
// these are all utility functions to help moving away from DW PHP-style parser
// list of supported modes. 
function Parser_GetModes() {
    var modes = Object.getOwnPropertyNames(Syntax);
    return modes;
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
                if (nodeAttrs.end !== void 0 &&
                    (attrs.end === void 0 || nodeAttrs.end > attrs.end)) attrs.end = nodeAttrs.end;
                
                var mincstart = Math.min(nodeAttrs.start, nodeAttrs.cstart);
                var maxcend = Math.max(nodeAttrs.end, nodeAttrs.cend);
                
                if (nodeAttrs.cstart !== void 0 &&
                    (attrs.cstart === void 0 || mincstart < attrs.cstart)) attrs.cstart = mincstart;
                if (nodeAttrs.cend !== void 0 &&
                    (attrs.cend === void 0 || maxcend > attrs.cend)) attrs.cend = maxcend;
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