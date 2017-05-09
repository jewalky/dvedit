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
            for (var i = 0; i < DVEdit.nextActions.length; i++) {
                var a = DVEdit.nextActions[i];
                if (a.action > 0 && a.mode === type)
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
    ['strong', 'emphasis', 'underline', 'deleted'],
    ['tablecell']
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
    deleted: Syntax_Formatting('deleted'),
    
    table: {
        allowedModes: PARSER_MODES.formatting
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.disabled)
                .concat(PARSER_MODES.protected),
        
        parserInit: function() {
            this.startPos = 0;
            this.tableData = [[]];
        },
        
        enter: /([\^|]+ *)/,
        pattern: /(\n\^ *|\n\| *| *\^ *| *\| *)/,
        leave: /\n|$/, // ;D our syntax parser allows comparing to end of string oddly enough
        
        process: function(match, state, pos, h) {
            switch (state) {
                case DOKU_LEXER_UNMATCHED: // td value
                    h.output += h._makeParagraphs(match, pos);
                    break;
                case DOKU_LEXER_ENTER: // start table
                    this.startPos = pos;
                case DOKU_LEXER_SPECIAL: // continue table
                case DOKU_LEXER_EXIT:
                    var t = match.trim();
                    t = t[t.length-1]==='^'?'th':'td';
                    // count spaces before and after
                    var spacesBefore = 0;
                    var spacesAfter = 0;
                    for (var i = 0; i < match.length; i++)
                        if (match[i] !== ' ') break;
                        else spacesBefore++;
                    for (var i = 0; i < match.length; i++)
                        if (match[match.length-1-i] !== ' ') break;
                        else spacesAfter++;
                    var lastRow = this.tableData[this.tableData.length-1];
                    if (match[0] === '\n')
                    {
                        this.tableData.push([{start: h.output.length, type: t, spacesBefore: spacesAfter, spacesAfter: 0}]);
                    }
                    else
                    {
                        if (lastRow.length)
                        {
                            lastRow[lastRow.length-1].spacesAfter = spacesBefore;
                            lastRow[lastRow.length-1].cend = pos;
                        }
                        lastRow.push({start: h.output.length, type: t, spacesBefore: spacesAfter, spacesAfter: 0, cstart: pos+match.length, cend: pos+match.length}); // null row for now
                    }
                    if (state === DOKU_LEXER_EXIT)
                        this.finalizeTable(match, state, pos, h);
                    break;
            }
        },
        
        // moved out into a separate function for easier editing
        finalizeTable: function(match, state, pos, h) {
            // collect text from h.output :D
            var firstText = -1;
            for (var y = 0; y < this.tableData.length; y++)
            {
                var row = this.tableData[y];
                for (var x = 0; x < row.length; x++)
                {
                    var cell = row[x];

                    if (firstText < 0)
                        firstText = cell.start;
                    
                    var next;
                    if (x+1 < row.length)
                        next = row[x+1].start;
                    else if (y+1 < this.tableData.length)
                        next = this.tableData[y+1][0].start;
                    else next = h.output.length;

                    cell.text = h.output.substring(cell.start, next);
                    
                    // remove if empty.
                    var tn = document.createElement('div');
                    tn.innerHTML = cell.text;
                    if ((tn.textContent === '' && !cell.spacesBefore && !cell.spacesAfter) || tn.textContent.trim() === ':::')
                    {
                        cell.text = null;
                        cell.vertical = tn.textContent!=='';
                    }
                    
                    if (tn.textContent === '')
                    {
                        cell.spacesAfter += cell.spacesBefore; // don't align right/center...
                        cell.spacesBefore = 0;
                        cell.cstart -= cell.spacesAfter;
                        //cell.cend += cell.spacesAfter;
                    }
                }
                
                if (row[row.length-1].text === null)
                    this.tableData[y] = row.slice(0, row.length-1);
            }

            h.output = h.output.substring(0, firstText);
            
            // produce table.
            // first off: absolute table start+end
            h.output += '<table class="inline">';
            for (var y = 0; y < this.tableData.length; y++)
            {
                var row = this.tableData[y];
                h.output += '<tr>';
                for (var x = 0; x < row.length; x++)
                {
                    var cell = row[x];
                    
                    if (cell.text === null)
                        continue;
                    
                    var colspan = 1;
                    var rowspan = 1;
                    
                    for (var i = x+1; i < row.length; i++)
                    {
                        if (row[i].text === null && !row[i].vertical)
                            colspan++;
                        else break;
                    }
                    
                    for (var i = y+1; i < this.tableData.length; i++)
                    {
                        if (this.tableData[i][x] && this.tableData[i][x].text === null && this.tableData[i][x].vertical)
                            rowspan++;
                        else break;
                    }
                    
                    // pick alignment
                    var align;
                    if (cell.spacesBefore >= 2 && cell.spacesAfter >= 2)
                        align = 'center';
                    else if (cell.spacesBefore >= 2 && cell.spacesAfter < 2)
                        align = 'right';
                    else align = 'left';
                    
                    // get base offsets
                    var inAttrs = h._getDVAttrsFromHTML(cell.text);
                    if (inAttrs.cstart === void 0 || inAttrs.cend === void 0)
                    {
                        inAttrs.cstart = cell.cstart+cell.spacesBefore;
                        inAttrs.cend = cell.cend-cell.spacesAfter;
                        inAttrs.start = cell.cstart;
                        inAttrs.end = cell.cend;
                    }
                    else
                    {
                        inAttrs.start -= cell.spacesBefore;
                        inAttrs.end += cell.spacesAfter;
                    }
                    
                    // individual table cell is needed? probably not. to be considered.
                    h.output += '<'+cell.type;
                    if (colspan > 1)
                        h.output += ' colspan="'+colspan+'"';
                    if (rowspan > 1)
                        h.output += ' rowspan="'+rowspan+'"';
                    h.output += ' style="text-align: '+align+'"';
                    h.output += ' '+h._getDVAttrs(inAttrs.start, inAttrs.end, inAttrs.cstart, inAttrs.cend, 'tablecell');
                    h.output += '>';
                    h.output += cell.text;
                    h.output += '</'+cell.type+'>';
                }
                h.output += '</tr>';
            }
            h.output += '</table>';
        },
        
        deleteType: DeleteType_Never
    },
    
    tablecell: {
        // these are from table
        allowedModes: PARSER_MODES.formatting
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.disabled)
                .concat(PARSER_MODES.protected),
                
        forbiddenStart: [' '],
        forbiddenEnd: [' '],
        forbidden: ['|', '^'],
        
        noLineBreak: true,
        
        deleteType: DeleteType_Never,
        
        enter: / */,
        leave: / */,
        
        manual: true,
        
        createControl: function(parent) {
            var sp = document.createElement('span');
            sp.innerHTML = 'Table: ';
            parent.appendChild(sp);
            
            var align = ['left', 'right', 'center'];
            var buttons = [];
            for (var i = 0; i < align.length; i++)
            {
                var dvButton = document.createElement('a');
                dvButton.setAttribute('class', 'dv-panel-button');
                dvButton.setAttribute('href', '#');
                dvButton.innerHTML = '<img src="lib/plugins/dvedit/img/table-'+align[i]+'.png" alt="'+align[i]+'">';
                buttons.push(dvButton);
                parent.appendChild(dvButton);
            }
            
            document.addEventListener('dv-selectionchange', function(e) {
                if (!DVEdit.isSelectionInEditor())
                    return;
                var xNodes = DVEdit.getNodesBySelection(true);
                for (var i = 0; i < buttons.length; i++)
                    buttons[i].setAttribute('class', 'dv-panel-button');
                parent.style.display = 'none';
                // if any nodes are in the table, show parent
                var found = false;
                for (var i = 0; i < xNodes.length; i++)
                {
                    var dvP = DVEdit.getAllDVParents(xNodes[i].node);
                    for (var j = 0; j < dvP.length; j++)
                    {
                        var dvDP = Parser_GetDVAttrsFromNode(dvP[j]);
                        if (dvDP.type === 'tablecell')
                        {
                            found = true;
                            // check padding
                            var l = dvDP.cstart-dvDP.start;
                            var r = dvDP.end-dvDP.cend;
                            if (l >= 2 && r < 2)
                                buttons[1].setAttribute('class', 'dv-panel-button dv-panel-button-active'); // align right
                            else if (l >= 2 && r >= 2)
                                buttons[2].setAttribute('class', 'dv-panel-button dv-panel-button-active'); // align center
                            else buttons[0].setAttribute('class', 'dv-panel-button dv-panel-button-active'); // align left (default)
                        }
                    }
                }
                
                if (found)
                {
                    parent.style.display = 'inline-block';
                }
            });

            var formats = [[' ', '  '], ['  ', ' '], ['  ', '  ']];
            for (var k = 0; k < buttons.length; k++)
            {
                buttons[k].fmt = formats[k];
                buttons[k].addEventListener('click', function(e) {
                    if (!DVEdit.isSelectionInEditor())
                        return;
                    var cp = DVEdit.getSourceLocation().cursorPosition;
                    var sc = DVEdit.SourceControl;
                    var currentSource = sc.value;
                    var fmt = this.fmt;
                    DVUndoRedo.addValue(currentSource, cp);
                    
                    var xNodes = DVEdit.getNodesBySelection(true);
                    var c1 = 0;
                    for (var i = 0; i < xNodes.length; i++)
                    {
                        var dvP = DVEdit.getAllDVParents(xNodes[i].node);
                        for (var j = 0; j < dvP.length; j++)
                        {
                            var dvDP = Parser_GetDVAttrsFromNode(dvP[j]);
                            if (dvDP.type === 'tablecell')
                            {
                                // unwrap cstart to cend, wrap again with specified padding.
                                if (dvDP.cstart===dvDP.cend)
                                    break; // ignore this
                                currentSource = currentSource.substring(0, dvDP.start-c1)+fmt[0]+currentSource.substring(dvDP.cstart-c1, dvDP.cend-c1)+fmt[1]+currentSource.substring(dvDP.end-c1);
                                var leftOffs = fmt[0].length-(dvDP.cstart-dvDP.start);
                                var rightOffs = fmt[1].length-(dvDP.end-dvDP.cend);
                                c1 += leftOffs+rightOffs;
                                cp += leftOffs;
                                if (cp >= dvDP.cend+c1)
                                    cp += rightOffs;
                                break;
                            }
                        }
                    }
                    
                    DVEdit.SourceControl.value = currentSource;
                    DVEdit.sourceInputChanged(true);
                    DVEdit.setCursorToSource(cp);
                    
                    DVEdit.Control.focus();
                    e.preventDefault();
                    return false;
                });
            }
            
            parent.style.display = 'none';
        }
    }
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

                if (attrs.cstart === void 0 || attrs.cstart > mincstart)
                    attrs.cstart = mincstart;
                if (attrs.cend === void 0 || attrs.cend < maxcend)
                    attrs.cend = maxcend;
            }
            attrs.start = attrs.cstart;
            attrs.end = attrs.cend;
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
                // note: 
                var o = document.createElement('div');
                o.innerHTML = outS[i];
                // check if first o element is not a format that belongs to CONTAINERS list
                var firstDV = o.firstChild;
                if (firstDV.textContent==='') // this is a hack - sometimes the \n\n before a block element registers as yet another empty span...
                    firstDV = firstDV.nextSibling;
                var dvData = Parser_GetDVAttrsFromNode(firstDV);
                if (firstDV && dvData)
                {
                    //
                    if (o.firstChild !== firstDV)
                        o.removeChild(o.firstChild);
                    if (PARSER_MODES.container.indexOf(dvData.type)!==-1 || dvData.type===void 0)
                    {
                        // just append this as-is, don't wrap in <p>
                        var newS = o.innerHTML;
                        output += newS;
                        pos += outS[i].length+2;
                        continue;
                    }
                }
                
                var inAttrs = this._getDVAttrsFromNodes(o.childNodes);
                if (!outS[i].length)
                {
                    inAttrs.start = inAttrs.cstart = pos;
                    inAttrs.end = inAttrs.cend = pos;
                }
                var newS = '<p '+this._getDVAttrs(inAttrs.start, inAttrs.end+2, inAttrs.cstart, inAttrs.cend, 'paragraph')+'>'+o.innerHTML+'</p>';
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
                var isN = (i !== outS.length-1) && (outS.length > 1);
                var s = outS[i].replace(/\u200b/g, '');
                s = s.replace(/\n/g, ' ');
                s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                var newS = '<span ' + this._getDVAttrs(pos, pos + outS[i].length, pos, pos + outS[i].length, 'base') + '>' + s + '</span>';
                output += newS + (isN ? '\n\n' : '');
                pos += outS[i].length+(isN?2:0);
            }
            return output;
        }
    };
}