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
    ['table'], ['tablecell']
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
    
    // this is used for <nowiki>
    unformatted: {
        allowedModes: [],
        enter: /<nowiki>/,
        leave: /<\/nowiki>/,
        
        process: function(match, state, pos, h) {
            Syntax.base.process(match, state, pos, h);
        },
        
        deleteType: DeleteType_Overlapping
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
    
    list: {
        allowedModes: PARSER_MODES.formatting
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.disabled)
                .concat(PARSER_MODES.protected),
                
        parserInit: function() {
            this.listData = [];
            this.baseLevel = 0;
        },
                
        enter: /((  )+(\*|\-))/,
        pattern: /(\n(  )+(\*|\-))/,
        leave: /(\n|$)/,
        
        process: function(match, state, pos, h) {
            switch (state) {
                case DOKU_LEXER_UNMATCHED: // item value
                    h.output += h._makeParagraphs(match, pos);
                    break;
                case DOKU_LEXER_ENTER: // start list
                    // do nothing special for now
                    this.listData = [];
                    this.baseLevel = 0;
                    h.registerFinalizer(Syntax.list.finalizeListCallback);
                case DOKU_LEXER_SPECIAL:
                    //console.log(match);
                    // here, "match" is the list marker on the right.
                    match = match.trimRight();
                    if (match[0] === '\n') match = match.substring(1);
                    var t = match[match.length-1];
                    var lev = (match.length-1)/2;
                    if (this.baseLevel === 0)
                        this.baseLevel = lev;// if anything is LESS than base level, it's considered base
                    else lev = Math.max(lev, this.baseLevel);
                    this.listData.push({start: h.output.length, level: lev, type: t});
                    break;
                case DOKU_LEXER_EXIT:
                    if (state === DOKU_LEXER_EXIT)
                    {
                        h.unregisterFinalizer(Syntax.list.finalizeListCallback);
                        this.finalizeList(h);
                    }
                    break;
            }
        },
        
        finalizeListCallback: function(h) {
            
        },
        
        finalizeList: function(h) {
            // take all contents
            this.listData.push({start: h.output.length, level: -1, type: void 0});
            for (var i = 0; i < this.listData.length-1; i++) {
                var dstart = this.listData[i].start;
                var dend = this.listData[i+1].start;
                this.listData[i].end = dend;
                this.listData[i].text = h.output.substring(dstart, dend);
            }
            
            h.output = h.output.substring(0, this.listData[0].start);
            
            // 
            var tree = { children: [], level: 1, type: 'ul' };
            var curdata = [ { node: tree, level: 0 } ];
            for (var i = 0; i < this.listData.length; i++) {
                var ld = this.listData[i];
                // we check ld.level
                // if it's higher than last recorded curdata level, then last element is a node
                // if it's lower than last recorded curdata level, then we need to close previous nodes and start next one
                if (ld.text === void 0)
                    break;
                console.log(ld.type);
                var nnode = { text: ld.text, type: (ld.type==='*'?'ul':'ol'), level: ld.level, children: [] };
                if (ld.level > curdata[curdata.length-1].level) { // enter
                    curdata[curdata.length-1].node.children.push(nnode);
                    if (this.listData[i+1].level > ld.level)
                        curdata.push( { node: nnode, level: ld.level } );
                } else if (ld.level < curdata[curdata.length-1].level) { // leave
                    //curdata = curdata.splice(0, curdata.length-1);
                    // find last node below this level
                    var j;
                    for (j = curdata.length-1; j >= 0; j--) {
                        if (curdata[j].level <= ld.level)
                            break;
                    }
                    curdata = curdata.splice(0, j);
                    curdata[curdata.length-1].node.children.push(nnode);
                } else {
                    curdata[curdata.length-1].node.children.push(nnode);
                }
            }
            
            function recurseList(node) {
                var html = '';
                var lastlt = void 0;
                for (var i = 0; i < node.children.length; i++) {
                    var child = node.children[i];
                    var lt = child.type;
                    if (lt !== lastlt) {
                        if (lastlt !== void 0)
                            html += '</'+lastlt+'>';
                        html += '<'+lt+'>';
                        lastlt = lt;
                    }
                    html += '<li class="level'+node.level+(child.children.length?' node':'')+'">';
                    html += child.text;
                    if (child.children.length) {
                        html += recurseList(child);
                    }
                    html += '</li>';
                }
                if (lastlt !== void 0)
                    html += '</'+lastlt+'>';
                return html;
            }
            
            h.output += recurseList(tree);
        }
    },
    
    table: {
        allowedModes: PARSER_MODES.formatting
                .concat(PARSER_MODES.substition)
                .concat(PARSER_MODES.disabled)
                .concat(PARSER_MODES.protected),
        
        parserInit: function() {
            this.startPos = 0;
            this.tableData = [[]];
            this.datas = [];
            this.dataNum = 0;
        },
        
        enter: /([\^|]+ *)/,
        pattern: /(\n\^ *|\n\| *| *\^ *| *\| *)/,
        leave: /(\n|$)/, // ;D our syntax parser allows comparing to end of string oddly enough
        
        process: function(match, state, pos, h) {
            switch (state) {
                case DOKU_LEXER_UNMATCHED: // td value
                    h.output += h._makeParagraphs(match, pos);
                    break;
                case DOKU_LEXER_ENTER: // start table
                    this.startPos = pos;
                    this.tableData = [[]];
                    h.registerFinalizer(Syntax.table.finalizeTableCallback);
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
                    {
                        h.unregisterFinalizer(Syntax.table.finalizeTableCallback);
                        this.finalizeTable(h);
                    }
                    break;
            }
        },
        
        //
        finalizeTableCallback: function(h) {
            return Syntax.table.finalizeTable(h);
        },
        
        // moved out into a separate function for easier editing
        finalizeTable: function(h) {
            // just in case: add null row
            /*if (this.tableData[this.tableData.length-1].length)
                this.tableData.push(null);*/
            
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
            h.output += '<table class="inline" dv-data="'+this.dataNum+'">';
            this.datas[this.dataNum] = this.tableData;
            this.dataNum++;
            for (var y = 0; y < this.tableData.length; y++)
            {
                var row = this.tableData[y];
                if (!row.length)
                    continue;//ignore null tr
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
                    
                    this.tableData[y][x].attrs = inAttrs;
                    
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
            h.output += '</table>\n\n';
            
            this.startPos = 0;
            this.tableData = [[]];
        },
        
        deleteType: DeleteType_Never,
        
        createControl: function(parent) {
            var dvButton = document.createElement('a');
            dvButton.setAttribute('class', 'dv-panel-button');
            dvButton.setAttribute('href', '#');
            dvButton.innerHTML = '<img src="lib/plugins/dvedit/img/table-create.png" alt="create table">';
            parent.appendChild(dvButton);
            
            dvButton.addEventListener('click', function(e) { 
                
                if (!DVEdit.isSelectionInEditor())
                {
                    e.preventDefault();
                    return false;
                }
                
                parent.style.display = 'inline-block';
                
                var xNodes = DVEdit.getNodesBySelection(true);
                // if any nodes are in the table, don't create
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
                            break;
                        }
                    }
                    
                    if (found) break;
                }
                
                if (found)
                {
                    e.preventDefault();
                    return false;
                }
                
                var wndbg = document.createElement('div'); wndbg.className = 'dv-popup-bg';
                var wnd = document.createElement('div'); wnd.className = 'dv-popup';
                var wnd_header = document.createElement('div'); wnd_header.className = 'dv-popup-header';
                var wnd_content = document.createElement('div'); wnd_content.className = 'dv-popup-content';
                var wnd_footer = document.createElement('div'); wnd_footer.className = 'dv-popup-header';
                wnd_footer.style.textAlign = 'right';
                wnd.appendChild(wnd_header);
                wnd.appendChild(wnd_content);
                wnd.appendChild(wnd_footer);
                wndbg.appendChild(wnd);
                DVEdit.Control.blur();
                document.body.appendChild(wndbg);
                wndbg.style.position = 'absolute';
                var r = DVEdit.Control.getBoundingClientRect();
                wndbg.style.left = (r.left+window.pageXOffset)+'px';
                wndbg.style.top = (r.top+window.pageYOffset)+'px';
                wndbg.style.width = r.width+'px';
                wndbg.style.height = r.height+'px';
                wnd_header.innerHTML = '<b>Create table</b>';
                
                var wnd_ok = document.createElement('button');
                wnd_ok.innerHTML = 'Create';
                var wnd_separator = document.createTextNode('\u00A0');
                var wnd_cancel = document.createElement('button');
                wnd_cancel.innerHTML = 'Cancel';
                wnd_footer.appendChild(wnd_ok);
                wnd_footer.appendChild(wnd_separator);
                wnd_footer.appendChild(wnd_cancel);
                
                //wnd_content.innerHTML = 'test';
                var h = '<table style="width: 100%"><tr><td><label>Rows:<br><input type="text" id="table-rows" value="3"></label></td>';
                h += '<td><label>Columns:<br><input type="text" id="table-columns" value="3"></label></td></tr></table>';
                h += '<label><input type="checkbox" checked id="table-header">With header</label>';
                wnd_content.innerHTML = h;
                
                function doClose() {
                    wndbg.parentNode.removeChild(wndbg);
                    DVEdit.Control.focus();
                }
                
                function doOk() {
                    var numRows = document.getElementById('table-rows').value*1;
                    var numCols = document.getElementById('table-columns').value*1;
                    if (isNaN(numRows) || numRows <= 0) numRows = 1;
                    if (isNaN(numCols) || numCols <= 0) numCols = 1;
                    var isHeader = !!document.getElementById('table-header').checked;
                    var tableSource = '\n\n';
                    if (isHeader)
                    {
                        for (var i = 0; i < numCols; i++)
                            tableSource += '^ Header '+(i+1)+' ';
                        tableSource += '^\n';
                    }
                    for (var j = 0; j < numRows; j++)
                    {
                        for (var i = 0; i < numCols; i++)
                            tableSource += '| Cell '+(j+1)+':'+(i+1)+' ';
                        tableSource += '|\n';
                    }
                    tableSource += '\n\n';
                    DVEdit.insertSource(tableSource);
                    doClose();
                }
                
                wndbg.addEventListener('keydown', function(e) {
                    if (e.keyCode == 27) {
                        doClose();
                    } else if (e.keyCode == 13) {
                        doOk();
                    }
                });
                
                wnd_cancel.addEventListener('click', function(e) {
                    doClose();
                });
                
                wnd_ok.addEventListener('click', function(e) {
                    doOk();
                });
                
                wnd_ok.focus();
                
                e.preventDefault();
                return false;
                
            });
            
            document.addEventListener('dv-selectionchange', function(e) {
                if (!DVEdit.isSelectionInEditor())
                    return;
                parent.style.display = 'inline-block';
                
                var xNodes = DVEdit.getNodesBySelection(true);
                // if any nodes are in the table, don't show "create table"
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
                            break;
                        }
                    }
                    
                    if (found) break;
                }
                
                //console.log(found);
                
                if (found)
                    parent.style.display = 'none';
            });
            
        }
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
            sp.innerHTML = 'Table&nbsp;cell:&nbsp;';
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
            
            var acts = ['addrow', 'addcol'];
            var actb = [];
            for (var i = 0; i < acts.length; i++)
            {
                var dvButton = document.createElement('a');
                dvButton.setAttribute('class', 'dv-panel-button');
                dvButton.setAttribute('href', '#');
                dvButton.setAttribute('action', acts[i]);
                dvButton.innerHTML = '<img src="lib/plugins/dvedit/img/table-'+acts[i]+'.png" alt="'+acts[i]+'">';
                actb.push(dvButton);
                parent.appendChild(dvButton);
                
                dvButton.addEventListener('click', function(e) {
                    if (!DVEdit.isSelectionInEditor())
                    {
                        e.preventDefault();
                        return false;
                    }
                    
                    parent.style.display = 'inline-block';
                    
                    var xNode = void 0;
                    var xNodes = DVEdit.getNodesBySelection(true);
                    for (var i = 0; i < xNodes.length; i++)
                    {
                        var dvP = DVEdit.getAllDVParents(xNodes[i].node);
                        for (var j = 0; j < dvP.length; j++)
                        {
                            var dvDP = Parser_GetDVAttrsFromNode(dvP[j]);
                            if (dvDP.type === 'tablecell')
                            {
                                xNode = dvDP;
                                xNode.node = dvP[j];

                                // work with this table cell and do nothing else
                                
                                break;
                            }
                        }
                        
                        if (xNode) break;
                    }
                    
                    if (!xNode)
                    {
                        e.preventDefault();
                        return false;
                    }
                    
                    // find current cell in table data
                    var cols = xNode.node.parentNode.childNodes;
                    var rows = xNode.node.parentNode.parentNode.childNodes;
                    var col, row;
                    for (col = 0; col < cols.length; col++)
                    {
                        if (cols[col] == xNode.node)
                            break;
                    }
                    
                    for (row = 0; row < rows.length; row++)
                    {
                        if (rows[row] == xNode.node.parentNode)
                            break;
                    }
                    
                    var tableData = Syntax.table.datas[xNode.node.parentNode.parentNode.parentNode.getAttribute('dv-data')*1];
                    //console.log(tableData);
                    
                    if (this.getAttribute('action') === 'addrow')
                    {
                        // add a new empty row below this one.
                        var offset = tableData[row][tableData[row].length-1].attrs.end;
                        var maxCols = 0;
                        for (var i = 0; i < tableData.length; i++)
                            maxCols = Math.max(maxCols, tableData[i].length);
                        var p = '|\n';
                        for (var i = 0; i < maxCols; i++)
                            p += '| Cell ';
                        DVEdit.insertSourceAtPosition(p, offset);
                        DVEdit.setCursorToSource(offset+4);
                    }
                    else
                    {
                        // add a new empty column next to this one.
                        var maxRows = tableData.length-1; // last is null
                        var goffset = 0;
                        var foffset = void 0;
                        for (var i = 0; i < maxRows; i++)
                        {
                            var offset = tableData[i][col].attrs.end;
                            var p = (tableData[i][col].type === 'td')?'|':'^';
                            p += ' Cell ';
                            if (foffset === void 0)
                                foffset = offset+goffset+2;
                            DVEdit.insertSourceAtPosition(p, offset+goffset);
                            goffset += p.length;
                        }
                        DVEdit.setCursorToSource(foffset);
                    }
                    
                    e.preventDefault();
                    return false;
                });
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
                    {
                        e.preventDefault();
                        return false;
                    }
                    
                    parent.style.display = 'inline-block';
                    
                    var xNodes = DVEdit.getNodesBySelection(true);
                    // if any nodes are in the table, don't create
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
                                break;
                            }
                        }
                        
                        if (found) break;
                    }
                    
                    if (!found)
                    {
                        e.preventDefault();
                        return false;
                    }
                    
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
                                c1 -= leftOffs+rightOffs;
                                cp -= leftOffs;
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
        finalizers: [],
        registerFinalizer: function(cb) {
            for (var i = 0; i < this.finalizers.length; i++) {
                if (this.finalizers[i] === cb)
                    return;
            }
            this.finalizers.push(cb);
        },
        
        unregisterFinalizer: function(cb) {
            for (var i = 0; i < this.finalizers.length; i++) {
                if (this.finalizers[i] === cb) {
                    this.finalizers.splice(i, 1);
                    i--;
                }
            }
        },
        
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
            // execute user finalizers
            for (var i = 0; i < this.finalizers.length; i++)
                this.finalizers[i](this);
            this.finalizers = [];
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
                if (firstDV && firstDV.tagName.toLowerCase() === 'span' && firstDV.textContent==='') // this is a hack - sometimes the \n\n before a block element registers as yet another empty span...
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