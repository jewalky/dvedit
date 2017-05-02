DVUndoRedo = {
    
    values: [],
    cursors: [],
    position: -1,
    
    maxSize: 1024*1024*2,

    // removes excessive undo/redo buffer values.
    cleanupValues: function()
    {
        
        var l = 0;
        var s = 0;
        for (var i = this.values.length-1; i >= 0; i--)
        {
            s += this.values[i].length;
            if (s > this.maxSize)
                l++;
        }
        this.values = this.values.slice(l);
        this.cursors = this.cursors.slice(l);
    },
    
    addValue: function(v, c)
    {
        if (this.values.length && this.values[this.values.length-1]===v)
            return false;
        
        if (this.position < 0)
        {
            this.values = [v];
            this.cursors = [c];
            this.position++;
        }
        else if (this.position >= this.values.length)
        {
            this.values.push(v);
            this.cursors.push(c);
        }
        else
        {
            this.values = this.values.slice(0, this.position);
            this.cursors = this.values.slice(0, this.position);
            this.values.push(v);
            this.cursors.push(c);
        }
        
        this.position++;
        return true;
    },
    
    clear: function()
    {
        this.values = [];
        this.cursors = [];
        this.position = -1;
    }
    
};

DVEdit = {
    
    init: function()
    {
        // init magic.
        document.addEventListener('keydown', function(e) { DVEdit.compatCheckSelection(); });
        document.addEventListener('keyup', function(e) { DVEdit.compatCheckSelection(); });
        document.addEventListener('keypress', function(e) { DVEdit.compatCheckSelection(); });
        document.addEventListener('mousemove', function(e) { DVEdit.compatCheckSelection(); });
        document.addEventListener('mousedown', function(e) { DVEdit.compatCheckSelection(); });
        document.addEventListener('mouseup', function(e) { DVEdit.compatCheckSelection(); });
        document.addEventListener('selectstart', function(e) { DVEdit.compatCheckSelection(); });
        
        this.SourceControl = document.querySelector('.dv-sourcecode');
        this.Control = document.querySelector('.dv-visualframe');
        
        //
        this.SourceControl.addEventListener('input', function(e){return DVEdit.sourceInputChanged(false);});
        this.Control.addEventListener('keypress', function(e){return DVEdit.visualKeyPress(e);});
        this.Control.addEventListener('keydown', function(e){return DVEdit.visualKeyDown(e);});
        this.Control.addEventListener('keyup', function(e){return DVEdit.visualKeyUp(e);});
        document.addEventListener('dv-selectionchange', function(e) {return DVEdit.selectionChanged(e);});
        
        this.Control.addEventListener('paste', function(e){return DVEdit.visualPaste(e);});
        this.Control.addEventListener('cut', function(e){return DVEdit.visualCut(e);});
       
        var dvPanel = document.querySelector('.dv-panel');
        SyntaxControls.forEach(function(group) {
            var dvGroup = document.createElement('div');
            dvGroup.setAttribute('class', 'dv-panel-group');
            dvPanel.appendChild(dvGroup);
            group.forEach(function(element) {
                var s = Syntax[element];
                if (!s.createControl)
                    return;
                s.createControl(dvGroup);
            });
        });
       
        //
        this.sourceInputChanged();
        this.setHandleSelection(true);
    },
    
    handleSelection: false,
    setHandleSelection: function(handle)
    {
        this.handleSelection = handle;
    },
    
    lastOffset: -1,
    lastNode: void 0,
    selectionChanged: function(e)
    {
        if (!this.handleSelection)
            return;
        
        if (!this.isSelectionInEditor())
            return;
        
        function checkParentDVType(node, type)
        {
            var p = node;
            while (p)
            {
                if (p.getAttribute && p.getAttribute('dv-type')===type)
                    return true;
                p = p.parentNode;
            }
            
            return false;
        }
        
        function findPrevTextSibling(node)
        {
            function findLastTextNode(node)
            {
                if (node.nodeType === Node.TEXT_NODE && checkParentDVType(node, 'base'))
                    return node;
                var s = node.lastChild;
                while (s)
                {
                    var o = findLastTextNode(s);
                    if (o) return o;
                    s = s.previousSibling;
                }
                return void 0;
            }
            
            var p = node;
            while (p && p != DVEdit.Control)
            {
                var s = p.previousSibling;
                while (s)
                {
                    var o = findLastTextNode(s);
                    if (o) return o;
                    s = s.previousSibling;
                }
                
                p = p.parentNode;
            }
            
            return void 0;
        }
        
        function findNextTextSibling(node)
        {
            function findFirstTextNode(node)
            {
                if (node.nodeType === Node.TEXT_NODE && checkParentDVType(node, 'base'))
                    return node;
                var s = node.firstChild;
                while (s)
                {
                    var o = findFirstTextNode(s);
                    if (o) return o;
                    s = s.nextSibling;
                }
                return void 0;
            }

            
            var p = node;
            while (p && p != DVEdit.Control)
            {
                var s = p.nextSibling;
                while (s)
                {
                    var o = findFirstTextNode(s);
                    if (o) return o;
                    s = s.nextSibling;
                }
                
                p = p.parentNode;
            }
            
            return void 0;
        }
        
        var selection = this.getSelection();
        var selectionNull = (selection.focusNode.nodeValue === '\u200b');
        
        var offset = selection.focusOffset;
        
        if (selectionNull)
        {
            if (offset === 1)
            {
                if (this.lastNode === selection.focusNode && this.lastOffset === 0)
                {
                    this.setHandleSelection(false);
                    var nextSibling = findNextTextSibling(selection.focusNode);
                    if (nextSibling)
                    {
                        var deflated = selection.focusNode === selection.anchorNode && selection.focusOffset === selection.anchorOffset;
                        selection.focusNode = nextSibling;
                        selection.focusOffset = 0;
                        if (deflated)
                        {
                            selection.anchorNode = nextSibling;
                            selection.anchorOffset = 0;
                        }
                    }
                    this.setSelection(selection);
                    this.setHandleSelection(true);
                }
                else
                {
                    this.setHandleSelection(false);
                    selection.focusOffset = 0;
                    this.setSelection(selection);
                    this.setHandleSelection(true);
                }
                
                this.lastNode = selection.focusNode;
                this.lastOffset = selection.focusOffset;
            }
        }
        
        this.selectionLastOffset = offset;
    },
    
    sourceInputChanged: function(manual)
    {
        if (!manual)
        {
            this.nextClear();
            DVUndoRedo.clear();
            DVUndoRedo.addValue(this.SourceControl.value, 0);
        }
        
        var sStart = this.SourceControl.selectionStart;
        var sEnd = this.SourceControl.selectionEnd;
        var newSource = this.SourceControl.value || '';
        this.SourceControl.value = newSource;
        this.SourceControl.selectionStart = sStart;
        this.SourceControl.selectionEnd = sEnd;
        
        var parsed = Parse(this.SourceControl.value);
        this.Control.innerHTML = parsed;
        
        // fix some things for editing.
        var xNode = void 0;
        var xNodes = this.Control.querySelectorAll('*');

        for (var i = 0; i < xNodes.length; i++)
        {
            xNode = xNodes[i];
            if (!xNode.getAttribute)
                continue;
            var dvData = Parser_GetDVAttrsFromNode(xNode);
            if ((dvData.cstart !== void 0 && dvData.cend !== void 0) && !xNode.lastChild)
            {
                // insert empty text. this is only visual!
                if (dvData.type !== 'base')
                {
                    var span = document.createElement('span');
                    span.setAttribute('dv-type', 'base');
                    span.setAttribute('dv-start', dvData.cend);
                    span.setAttribute('dv-end', dvData.cstart);
                    span.setAttribute('dv-cstart', dvData.cend);
                    span.setAttribute('dv-cend', dvData.cstart);
                    span.textContent = '\u200b';
                    xNode.appendChild(span);
                }
                else
                {
                    var textNode = document.createTextNode('\u200b');
                    xNode.appendChild(textNode);
                }
            }
            else if ((dvData.cstart !== void 0 && dvData.cend !== void 0) && (xNode.firstChild !== xNode.lastChild) && (xNode.lastChild.tagName === 'SPAN'))
            {
                if (!xNode.lastChild.firstChild || xNode.lastChild.textContent === '\u200b')
                    xNode.removeChild(xNode.lastChild);
            }
            else if ((dvData.cstart !== void 0 && dvData.cend !== void 0) && (xNode.firstChild !== xNode.lastChild) && (xNode.firstChild.tagName === 'SPAN'))
            {
                if (!xNode.firstChild.firstChild || xNode.firstChild.textContent === '\u200b')
                    xNode.removeChild(xNode.firstChild);
            }
            else if (dvData.cstart === void 0 || dvData.cend === void 0)
            {
                // make sure that we can edit text after and before block elements.
                var xNode0 = xNode.previousSibling;
                var xNode1 = xNode.nextSibling;
                if (xNode1 && xNode1.getAttribute)
                {
                    var dvData1 = Parser_GetDVAttrsFromNode(xNode1);
                    if (dvData1.cstart === void 0 || dvData1.cend === void 0)
                    {
                        if (dvData.end !== void 0 && dvData1.start !== void 0)
                        {
                            // insert empty span.
                            var span = document.createElement('span');
                            span.setAttribute('dv-type', 'base');
                            span.setAttribute('dv-start', dvData.end);
                            span.setAttribute('dv-end', dvData1.start);
                            span.setAttribute('dv-cstart', dvData.end);
                            span.setAttribute('dv-cend', dvData1.start);
                            span.textContent = '\u200b';
                            xNode1.parentNode.insertBefore(span, xNode1);
                        }
                    }
                }
                else if (!xNode1)
                {
                    if (dvData.end !== void 0)
                    {
                        var span = document.createElement('span');
                        span.setAttribute('dv-type', 'base');
                        span.setAttribute('dv-start', dvData.end);
                        span.setAttribute('dv-end', dvData.end);
                        span.setAttribute('dv-cstart', dvData.end);
                        span.setAttribute('dv-cend', dvData.end);
                        span.textContent = '\u200b';
                        xNode.parentNode.appendChild(span);
                    }
                }
                if (!xNode0)
                {
                    if (dvData.start !== void 0)
                    {
                        var span = document.createElement('span');
                        span.setAttribute('dv-type', 'base');
                        span.setAttribute('dv-start', dvData.start);
                        span.setAttribute('dv-end', dvData.start);
                        span.setAttribute('dv-cstart', dvData.start);
                        span.setAttribute('dv-cend', dvData.start);
                        span.textContent = '\u200b';
                        xNode.parentNode.insertBefore(span, xNode);
                    }
                }
            }
        }
    },
    
    triggerSelectionChange: function(e)
    {
        var selChange = document.createEvent('CustomEvent'); // https://habrahabr.ru/post/229189/#comment_7763483 - don't really want to check if it's true.
        selChange.initCustomEvent('dv-selectionchange', false, false, {});
        document.dispatchEvent(selChange);
    },
    
    compatOldSelection: void 0,
    compatCheckSelection: function(e)
    {
        var sel = this.getSelection();
        if (this.compatOldSelection === void 0)
        {
            this.compatOldSelection = sel;
            this.triggerSelectionChange();
        }
        else
        {
            var sel2 = this.compatOldSelection;
            if (sel.anchorNode !== sel2.anchorNode ||
                sel.anchorOffset !== sel2.anchorOffset ||
                sel.focusNode !== sel2.focusNode ||
                sel.focusOffset !== sel2.focusOffset)
            {
                this.compatOldSelection = sel;
                this.triggerSelectionChange();
            }
        }
    },
    
    visualKeyPress: function(e)
    {
        if (e.which < 0x20)
            return;
        var ctrlDown = (e.ctrlKey || e.cmdKey);
        if (ctrlDown)
            return;
        
        var ch = String.fromCharCode(e.which);
        this.insertSource(ch, true, true);
        
        //
        e.preventDefault();
        return false;
    },
    
    deleteAllEmptyInSelection: function()
    {
        var selection = this.getSelection();
        
        if (this.isMultiSelection())
        {
            // do nothing for now
        }
        else
        {
            var dvSelL = this.getAllDVParents(selection.focusNode);
            var dvSel = dvSelL[0];
            var start, end;
            // find topmost empty element.
            for (var i = 0; i < dvSelL.length; i++)
            {
                var dvData = Parser_GetDVAttrsFromNode(dvSelL[i]);
                
                var rules = Syntax[dvData.type];
                var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
                if (dType === DeleteType_Empty && (!i || (dvSelL[i].firstChild===dvSelL[i].lastChild)))
                {
                    start = dvData.start;
                    end = dvData.end;
                    dvSel = dvSelL[i];
                }
                else break;
            }
            
            var currentSource = this.SourceControl.value;
            currentSource = currentSource.substr(0, start)+currentSource.substr(end);
            this.SourceControl.value = currentSource;
            
            this.sourceInputChanged(true);
            this.setCursorToSource(start);
        }
    },
    
    getFlatNodes: function(fstart, fend)
    {
        if (fstart === void 0) fstart = 0;
        if (fend === void 0) fend = 2147483647;
        
        // output:
        //  - text - list of text nodes
        //  - boundaries - list of boundaries (text inside a non-deleting non-merging node)
        //  - codes - list of codes (start, end, link to start/end)
        // important: all sorted by order!
        var output = [];
        
        var xNodes = this.Control.querySelectorAll('*[dv-type]');
        for (var i = 0; i < xNodes.length; i++)
        {
            var dvData = Parser_GetDVAttrsFromNode(xNodes[i]);
            var rules = Syntax[dvData.type];
            var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
            if (dvData.cstart !== void 0 && dvData.cend !== void 0)
            {
                if (dvData.type === 'base')
                {
                    // text node
                    var o = {
                        type: 'base',
                        start: dvData.cstart,
                        end: dvData.cend
                    };
                    output.push(o);
                }
                else if (dvData.cstart !== dvData.start || dvData.cend !== dvData.end)
                {
                    var start = {
                        type: dvData.type,
                        start: dvData.start,
                        end: dvData.cstart,
                        position: 'start',
                        rules: rules,
                        deleteType: dType
                    };
                    var end = {
                        type: dvData.type,
                        start: dvData.cend,
                        end: dvData.end,
                        position: 'end',
                        rules: rules,
                        deleteType: dType
                    };
                    start.other = end;
                    end.other = start;
                    output.push(start);
                    output.push(end);
                }
            }
            else
            {
                var o = {
                    type: dvData.type,
                    start: dvData.start,
                    end: dvData.end,
                    block: true,
                    rules: rules,
                    deleteType: dType
                };
                output.push(o);
            }
        }
        
        output.sort(function(a, b) {
            if (a.start === b.start)
                return a.end-b.end;
            return a.start-b.start;
        });
        
        output = output.filter(function(a) {
            return (a.end >= fstart && a.start < fend);
        });
        
        return output;
    },
    
    visualKeyDown: function(e)
    {
        var c = String.fromCharCode(e.keyCode);
        
        var ctrlDown = (e.ctrlKey || e.cmdKey);
        
        // enter key
        if (e.keyCode === 13)
        {
            var allowLB = true;
            var s = this.getSelection();
            var dvP = this.getAllDVParents(s.anchorNode);
            var modes = [];
            for (var i = 0; i < dvP.length; i++)
            {
                var dvData = Parser_GetDVAttrsFromNode(dvP[i]);
                
                if (!!Syntax[dvData.type].noLineBreak)
                {
                    allowLB = false;
                    break;
                }
                else
                {
                    modes.push(dvData.type);
                }
            }
            
            if (e.shiftKey || !allowLB) // in tables, you can only do \\ 
            {
                this.insertSource('\\\\ ');
            }
            else
            {
                var cursor2 = this.insertSource('\n\n');
                var cursor2p = cursor2;
                var cursor1 = cursor2-2;
                for (var i = 0; i < modes.length; i++)
                {
                    // unwrap this part.
                    var r = this.unwrapFormat(modes[i], cursor1, cursor2);
                    cursor1 = r[0];
                    cursor2 = r[1];
                    console.log(cursor2-cursor2p)
                }
                this.setCursorToSource(cursor2+(cursor2-cursor2p)); // todo: fix magic once I have free time... I don't know how/why this works at all. but it def does.
                for (var i = modes.length-1; i >= 0; i--)
                {
                    if (Syntax[modes[i]].formatStart && Syntax[modes[i]].formatEnd)
                        this.nextAdd(1, modes[i]);
                }
            }
        }
        else if (e.keyCode === 8) // backspace
        {
            if (this.isMultiSelection())
            {
                this.removeSelection();
            }
            else
            {
                var nextChar = false;
                do
                {
                    var c = this.getSourceSelection()[1];
                    DVUndoRedo.addValue(this.SourceControl.value, c);
                    var fn = this.getFlatNodes(0, c);
                    if (!fn.length || !c)
                        break;
                    // find some characters to the left of c.
                    for (var i = fn.length-1; i >= 0; i--)
                    {
                        var node = fn[i];
                        // if this is a boundary, stop completely.
                        if (node.deleteType === DeleteType_Never)
                        {
                            nextChar = false;
                            break;
                        }
                        // if this is a block code, delete it.
                        else if (node.deleteType === DeleteType_Overlapping)
                        {
                            this.removeSource(node.start, node.end, false);
                            nextChar = false;
                            break;
                        }
                        // special case: if this node is a paragraph, and we are at the start of it, merge paragraphs.
                        else if (node.type === 'paragraph' && node.end === c)
                        {
                            // merge paragraphs, kinda.
                            c -= 2;
                            this.removeSource(c, c+2, false);
                            // find last suitable node to put cursor into.
                            for (i = i-1; i >= 0; i--)
                            {
                                node = fn[i];
                                if (node.type === 'base' || node.block)
                                {
                                    c = node.end;
                                    break;
                                }
                            }
                            nextChar = false;
                            break;
                        }
                        else if (node.type === 'base' && node.start <= c)
                        {
                            // remove char
                            c = Math.min(c, node.end)-1;
                            var rc = this.SourceControl.value.substring(c, c+1);
                            nextChar = rc.length && !rc.match(/\s/); // stop on whitespace.
                            this.removeSource(c, c+1, false);
                            if (c === node.start)
                            {
                                // find last suitable node to put cursor into.
                                for (i = i-1; i >= 0; i--)
                                {
                                    if (node.type === 'paragraph')
                                        break;
                                    
                                    node = fn[i];
                                    if (node.type === 'base' || node.block)
                                    {
                                        c = node.end;
                                        break;
                                    }
                                }
                            }
                            break;
                        }
                    }
                    this.optimizeTags(c);
                }
                while (nextChar && ctrlDown);
            }
        }
        else if (e.keyCode == 46) // delete
        {
            if (this.isMultiSelection())
            {
                this.removeSelection();
            }
            else
            {
                var nextChar = false;
                do
                {
                    var c = this.getSourceSelection()[1];
                    DVUndoRedo.addValue(this.SourceControl.value, c);
                    var fn = this.getFlatNodes(c);
                    // the best part about this is that we don't need to set cursor position!
                    for (var i = 0; i < fn.length; i++)
                    {
                        var node = fn[i];
                        if (node.type === 'paragraph' && node.position === 'start')
                            continue; // parasitic entity, 0 characters long.
                        if (node.deleteType === DeleteType_Never)
                        {
                            nextChar = false;
                            break;
                        }
                        else if (node.deleteType === DeleteType_Overlapping)
                        {
                            this.removeSource(node.start, node.end, false);
                            nextChar = false;
                            break;
                        }
                        else if (node.type === 'paragraph' && c < node.end)
                        {
                            this.removeSource(node.start, node.end, false);
                            for (i = i+1; i < fn.length; i++)
                            {
                                node = fn[i];
                                if (node.type === 'base' || node.block)
                                {
                                    c = node.start-2;
                                    break;
                                }
                            }
                            nextChar = false;
                            break;
                        }
                        else if (node.type === 'base' && node.end >= c+1)
                        {
                            c = Math.max(c, node.start);
                            var rc = this.SourceControl.value.substring(c, c+1);
                            nextChar = rc.length && !rc.match(/\s/); // stop on whitespace.
                            this.removeSource(c, c+1, false);
                            if (c+1 === node.end)
                            {
                                for (i = i+1; i < fn.length; i++)
                                {
                                    if (node.type === 'paragraph')
                                        break;
                                    
                                    node = fn[i];
                                    if (node.type === 'base' || node.block)
                                    {
                                        c = node.start-1;
                                        break;
                                    }
                                }
                            }
                            break;
                        }
                    }
                    this.optimizeTags(c);
                }
                while (nextChar && ctrlDown);
            }
        }
        else if (ctrlDown) // ctrl+something
        {
            if (e.keyCode === 0x11) // ctrl itself.
                return true;
                
            if (c === 'C') // allow copy
            {
                return true;
            }
            else if (c === 'Z' && !e.shiftKey) // undo
            {
                if (DVUndoRedo.position > 0)
                {
                    //
                    DVUndoRedo.position--;
                    this.SourceControl.value = DVUndoRedo.values[DVUndoRedo.position];
                    this.sourceInputChanged(true);
                    this.setCursorToSource(DVUndoRedo.cursors[DVUndoRedo.position]);
                }
            }
            else if ((c === 'Z' && e.shiftKey) || (c === 'Y')) // redo (ctrl+Y or ctrl+shift+Z)
            {
                if (DVUndoRedo.position >= 0 && DVUndoRedo.position < DVUndoRedo.values.length-1)
                {
                    DVUndoRedo.position++;
                    this.SourceControl.value = DVUndoRedo.values[DVUndoRedo.position];
                    this.sourceInputChanged(true);
                    this.setCursorToSource(DVUndoRedo.cursors[DVUndoRedo.position]);
                }
            }
            else if (c === 'A') // allow select all
            {
                return true;
            }
            else if (e.keyCode >= 33 && e.keyCode <= 40) // allow ctrl+arrows, pgup/pgdn/end/home
            {
                return true;
            }
        }
        else return true;
        
        //
        e.preventDefault();
        return false;
    },
    
    visualKeyUp: function(e)
    {
        //
        e.preventDefault();
        return false;
    },
    
    visualPaste: function(e)
    {
        //
        e.preventDefault();
        return false;
    },
    
    visualCut: function(e)
    {
        //
        e.preventDefault();
        return false;
    },

    isSelectionInEditor: function()
    {
        function checkParent(e, p) {
            while (e && e !== document) {
                if (e === p)
                    return true;
                e = e.parentNode;
            }
            return false;
        }
        
        var selection = this.getSelection();
        return checkParent(selection.focusNode, this.Control) && checkParent(selection.anchorNode, this.Control);
    },
    
    isMultiSelection: function()
    {
        var selection = this.getSelection();
        if (selection.anchorNode !== selection.focusNode)
            return true;
        if (selection.anchorOffset !== selection.focusOffset)
            return true;
        return false;
    },
    
    // this function retrieves first parent element with dv-type.
    getFirstDVParent: function(base)
    {
        while (base && base !== this.Control)
        {
            if (base.getAttribute && base.getAttribute('dv-type') !== void 0)
                return base;
            base = base.parentNode;
        }
        
        return void 0;
    },
    
    // this function retrieves all parents with dv-type until control.
    getAllDVParents: function(base)
    {
        var list = [];
        while (base && base !== this.Control)
        {
            if (base.getAttribute && base.getAttribute('dv-type') !== void 0)
                list.push(base);
            base = base.parentNode;
        }
        
        return list;
    },
    
    getAllDVChildren: function(base)
    {
        var list = [];
        if (base.nodeType === Node.TEXT_NODE)
            return list;
        
        base = base.firstChild;
        while (base)
        {
            if (base.nodeType !== Node.TEXT_NODE && base.hasAttribute('dv-type'))
                list.push(base);
            list = list.concat(this.getAllDVChildren(base));
            base = base.nextSibling;
        }
        
        return list;
    },
    
    // this retrieves DV node by source location
    getDVNodeBySource: function(index)
    {
        for (var j = 0; j < 2; j++)
        {
            var invSign = [1, -1][j];
            
            var xNodes = this.Control.querySelectorAll('*[dv-type][dv-cstart][dv-cend]');
            var xMin = 0;
            var xMax = 2147483647;
            var xOutNode = void 0;
            
            var currentSource = this.SourceControl.value;
            if (index > currentSource.length)
                index = currentSource.length;
            if (index < 0)
                index = 0;

            for (var i = 0; i < xNodes.length; i++)
            {
                var xNode = xNodes[i];
                if (xNode.firstChild.nodeType !== Node.TEXT_NODE)
                    continue;
                if (this.getAllDVChildren(xNode).length)
                    continue;
                
                var attrs = Parser_GetDVAttrsFromNode(xNode);

                var cstarts = [attrs.cstart];
                var cends = [attrs.cend];
                
                var p = xNode.parentNode;
                while (p && p !== this.Control)
                {
                    var attrs2 = Parser_GetDVAttrsFromNode(p);
                    cstarts.push(attrs2.cstart);
                    
                    if (p.parentNode.firstChild === p)
                        p = p.parentNode;
                    else break;
                }
                
                p = xNode.parentNode;
                while (p && p !== this.Control)
                {
                    var attrs2 = Parser_GetDVAttrsFromNode(p);
                    cends.push(attrs2.cend);
                    
                    if (p.parentNode.lastChild === p)
                        p = p.parentNode;
                    else break;
                }
                
                var cstart = cstarts.sort(function(a,b){ return -Math.sign(a-b)*invSign; })[0];
                var cend = cends.sort(function(a,b){ return Math.sign(a-b)*invSign; })[0];
                
                if (cstart === void 0 || cend === void 0) // not editable element
                    continue;
                if (cstart > index || cend < index)
                    continue;
                
                if (cstart === index && cend === index)
                    return xNode;
                
                if (cstart > xMin || cend < xMax)
                {
                    xMin = cstart;
                    xMax = cend;
                    xOutNode = xNode;
                }
            }
            
            if (xOutNode)
                return xOutNode;
        }
        
        return void 0;
    },
    
    getSelection: function()
    {
        var selection = window.getSelection();
        return { focusNode: selection.focusNode, focusOffset: selection.focusOffset, 
                 anchorNode: selection.anchorNode, anchorOffset: selection.anchorOffset };
    },
    
    setSelection: function(sel, noset)
    {
        try
        {
            var range = document.createRange();
            range.setStart(sel.anchorNode, Math.min(sel.anchorNode.nodeValue.length, sel.anchorOffset));
            range.setEnd(sel.focusNode, Math.min(sel.focusNode.nodeValue.length, sel.focusOffset));
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            if (this.handleSelection)
                this.triggerSelectionChange();
        }
        catch (e)
        {
            // ...?
        }
    },
    
    setCursorToSource: function(index, end)
    {
        var selection = this.getSelection();
        
        if (index < 0)
            index = 0;
        var maxSource = this.SourceControl.value.length;
        if (index > maxSource)
            index = maxSource;
        
        if (end === void 0)
            end = index;
        
        if (end < 0)
            end = 0;
        if (end > maxSource)
            end = maxSource;
        
        var dvSel1 = this.getDVNodeBySource(index);
        var dvSel2 = this.getDVNodeBySource(end);
        
        var dvData1 = Parser_GetDVAttrsFromNode(dvSel1);
        var dvData2 = Parser_GetDVAttrsFromNode(dvSel2);
        
        if (!dvSel1 || !dvSel2)
            return; // note: remove for debugging
        
        if (dvSel2.firstChild)
        {
            selection.focusNode = dvSel2.firstChild;
            selection.focusOffset = end-dvData2.cstart;
        }
        else
        {
            selection.focusNode = dvSel2;
            selection.focusOffset = 0;
        }
        
        if (dvSel1.firstChild)
        {
            selection.anchorNode = dvSel1.firstChild;
            selection.anchorOffset = index-dvData1.cstart;
        }
        else
        {
            selection.anchorNode = dvSel1;
            selection.anchorOffset = 0;
        }
        
        this.setSelection(selection);
    },
    
    getSourceLocation: function(focusNode, focusOffset)
    {
        if (focusNode === void 0 || focusOffset === void 0)
        {
            var selection = this.getSelection();
            focusNode = selection.focusNode;
            focusOffset = selection.focusOffset;
        }
        
        // extremely special case.
        if (this.SourceControl.value.length)
        {
            // find first element with dv-type.
            var dvSel = this.getFirstDVParent(focusNode);
            var dvData = Parser_GetDVAttrsFromNode(dvSel);
            var cursorPosition = focusOffset+dvData.cstart;
        }
        else
        {
            var dvSel = this.Control.querySelector('p');
            var dvData = Parser_GetDVAttrsFromNode(dvSel);
            var cursorPosition = 0;
        }
        
        return {
            dvSel: dvSel,
            dvData: dvData,
            cursorPosition: cursorPosition
        };
    },
    
    getSourceSelection: function()
    {
        var sel = this.getSelection();
        var c2 = this.getSourceLocation(sel.focusNode, sel.focusOffset);
        var c1 = this.getSourceLocation(sel.anchorNode, sel.anchorOffset);
        return [c1.cursorPosition, c2.cursorPosition];
    },
    
    getNodesBySelection: function(all)
    {
        all = !!all;
        
        var selection = this.getSelection();
        
        if (selection.anchorNode === this.Control && selection.focusNode === this.Control)
        {
            var cursor1 = 0;
            var cursor2 = this.SourceControl.value.length;
        }
        else
        {
            var s1 = this.getSourceLocation(selection.anchorNode, selection.anchorOffset);
            var s2 = this.getSourceLocation(selection.focusNode, selection.focusOffset);
            var cursor1 = s1.cursorPosition;
            var cursor2 = s2.cursorPosition;
            if (cursor2 < cursor1)
            {
                var t = cursor2;
                cursor2 = cursor1;
                cursor1 = t;
            }
        }
        
        return this.getNodesBySource(cursor1, cursor2, all);
    },
    
    getNodesBySource: function(cursor1, cursor2, all)
    {
        all = !!all;
        
        var xNode;
        var xNodes = [];
        var xNodes2 = this.Control.querySelectorAll('*');
        for (var i = 0; i < xNodes2.length; i++)
        {
            var xNode = xNodes2[i];
            var dvData = Parser_GetDVAttrsFromNode(xNode);
            if (!dvData.type)
                continue;
            if (dvData.start > cursor2 || dvData.end < cursor1)
                continue;
            if (dvData.cstart !== void 0 && dvData.cend !== void 0)
            {
                if ((xNode.firstChild.nodeType !== Node.TEXT_NODE) && !all)
                    continue;
                if (dvData.cstart > cursor2 || dvData.cend < cursor1)
                    continue;
                var dvParent = this.getAllDVParents(xNode);
                var dvDataP = Parser_GetDVAttrsFromNode(dvParent[1]);
                dvData.type = dvDataP.type;
                dvData.rstart = dvDataP.start;
                dvData.rend = dvDataP.end; // real start/end for deletion of whole formats.
            }
            else
            {
                dvData.rstart = dvData.start;
                dvData.rend = dvData.end;
            }
            
            var rules = Syntax[dvData.type];
            if (!rules)
                continue;
            dvData.node = xNode;
            dvData.rules = rules;
            xNodes.push(dvData);
        }
        
        xNodes.sort(function(a, b) {
            if (a.start < b.start)
                return -1;
            if (a.start > b.start)
                return 1;
            if (a.cstart !== void 0 && b.cstart !== void 0)
            {
                if (a.cstart < b.cstart)
                    return -1;
                if (a.cstart > b.cstart)
                    return 1;
            }
            return 0;
        });
        
        return xNodes;
    },
    
    // removes currently selected block.
    removeSelection: function(doUndoRedo)
    {
        if (!this.isMultiSelection())
            return;
        
        var selection = this.getSelection();
        
        // 1. get source location of start and end of selection.
        // 2. get all elements that fall under this range.
        // 3. process according to the rules.
        
        if (selection.anchorNode === this.Control && selection.focusNode === this.Control)
        {
            var cursor1 = 0;
            var cursor2 = this.SourceControl.value.length;
        }
        else
        {
            var s1 = this.getSourceLocation(selection.anchorNode, selection.anchorOffset);
            var s2 = this.getSourceLocation(selection.focusNode, selection.focusOffset);
            var cursor1 = s1.cursorPosition;
            var cursor2 = s2.cursorPosition;
            if (cursor2 < cursor1)
            {
                var t = cursor2;
                cursor2 = cursor1;
                cursor1 = t;
            }
        }
        
        var currentSource = this.SourceControl.value;
        if (doUndoRedo===void 0 || doUndoRedo) DVUndoRedo.addValue(currentSource, cursor2);
        
        var xNodes = this.getNodesBySource(cursor1, cursor2);
        
        var offset1 = 0;
        var startBlock = xNodes[0];
        var stillHaveNodes = false;
        
        for (var i = 0; i < xNodes.length; i++)
        {
            var dvData = xNodes[i];
            xNode = xNodes[i].node;
            var rules = xNodes[i].rules;
            var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
            var hasContent = (dvData.cstart !== void 0 && dvData.cend !== void 0);

            switch (dType)
            {
                case DeleteType_Overlapping:
                    // just remove the node entirely.
                    this.removeSource(dvData.rstart+offset1, dvData.rend+offset1, false);
                    offset1 -= dvData.rend-dvData.rstart;
                    cursor2 -= dvData.rend-dvData.rstart;
                    break;
                case DeleteType_Empty:
                    if (!hasContent)
                        continue;
                    // remove content in the node
                    var start = Math.max(cursor1, dvData.cstart);
                    var end = Math.min(cursor2-offset1, dvData.cend);
                    start += offset1;
                    end += offset1;
                    this.removeSource(start, end, false);
                    offset1 -= end-start;
                    cursor2 -= end-start;
                    break;
                case DeleteType_Never:
                    if (!hasContent)
                        continue;
                    // remove content in the node
                    var start = Math.max(cursor1, dvData.cstart);
                    var end = Math.min(cursor2-offset1, dvData.cend);
                    start += offset1;
                    end += offset1;
                    this.removeSource(start, end, false);
                    offset1 -= end-start;
                    cursor2 -= end-start;
                    stillHaveNodes = true;
                    break;
                default:
                    stillHaveNodes = true;
                    break;
            }
        }
        
        if (xNodes.length > 1)
        {
            // if end node is the same as start node (type-wise), we can merge.
            if (xNodes[0].type === xNodes[xNodes.length-1].type &&
                xNodes[0].rules.deleteType !== DeleteType_Overlapping &&
                !stillHaveNodes)
            {
                var start = cursor1;
                var end = cursor2;
                this.removeSource(start, end, false);
                offset1 -= end-start;
                cursor2 -= end-start;
            }
        }
        
        this.optimizeTags(cursor1);
    },
    
    optimizeTags: function(cursorOverride)
    {
        var selection = this.getSelection();
        
        // 1. get source location of start and end of selection.
        // 2. get all elements that fall under this range.
        // 3. process according to the rules.
        
        if (selection.anchorNode === this.Control && selection.focusNode === this.Control)
        {
            var cursor1 = 0;
            var cursor2 = this.SourceControl.value.length;
        }
        else
        {
            var s1 = this.getSourceLocation(selection.anchorNode, selection.anchorOffset);
            var s2 = this.getSourceLocation(selection.focusNode, selection.focusOffset);
            var cursor1 = s1.cursorPosition;
            var cursor2 = s2.cursorPosition;
            if (cursor2 < cursor1)
            {
                var t = cursor2;
                cursor2 = cursor1;
                cursor1 = t;
            }
        }
        
        if (cursorOverride !== void 0)
            cursor1 = cursor2 = cursorOverride;
        
        var offset1 = 0;
        var offset2 = 0;
        
        //console.log('st0', cursor1, cursor2, offset1, offset2);
        
        // find tags that don't have any content and are DeleteType_Empty, and unwrap them.
        // find tags that are adjacent to each other and have same type, start and end, and merge them.
        
        var removeList = [];
        
        var xNodes = this.Control.querySelectorAll('*[dv-type][dv-cstart][dv-cend]');
        for (var i = 0; i < xNodes.length; i++)
        {
            var dvData = Parser_GetDVAttrsFromNode(xNodes[i]);
            if (dvData.type === 'base')
                continue;
            if (dvData.type === 'paragraph')
                continue; // very special type, don't try to do anything about it...
            
            var rules = Syntax[dvData.type];
            var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
            if (dType !== DeleteType_Empty)
                continue;
            // check for direct base members.
            var c = xNodes[i].firstChild;
            if (!c) continue;
            
            var countNonEmpty = 0;
            var xCNodes = xNodes[i].querySelectorAll('*[dv-type="base"]');
            for (var j = 0; j < xCNodes.length; j++)
            {
                if (!xCNodes[j].firstChild)
                    continue;
                if (xCNodes[j].firstChild.nodeType === Node.TEXT_NODE)
                {
                    var t = xCNodes[j].firstChild.nodeValue;
                    if (t === '' || t === '\u200b')
                        continue;
                }
                countNonEmpty++;
            }
            
            if (!countNonEmpty)
            {
                removeList.push([dvData.start, dvData.cstart]);
                removeList.push([dvData.cend, dvData.end]);
            }
        }
        
        removeList.sort(function(a,b) { return a[0]-b[0]; });
        
        // remove everything from the remove list.
        // this, in turn, can enable merging.
        var offset = 0;
        for (var i = 0; i < removeList.length; i++)
        {
            var len = removeList[i][1]-removeList[i][0];
            if (removeList[i][0] < cursor1)
                offset1 += len;
            if (removeList[i][0] < cursor2)
                offset2 += len;
            this.removeSource(removeList[i][0]-offset, removeList[i][1]-offset, false);
            offset += len;
        }
        
        //console.log('st1', cursor1, cursor2, offset1, offset2);
        cursor1-=offset1;
        cursor2-=offset2;
        offset1 = 0;
        offset2 = 0;
        
        removeList = [];
        xNodes = this.Control.querySelectorAll('*[dv-type][dv-cstart][dv-cend]');
        var currentSource = this.SourceControl.value;
        for (var i = 0; i < xNodes.length; i++)
        {
            var dvData = Parser_GetDVAttrsFromNode(xNodes[i]);
            if (dvData.type === 'base')
                continue;
            if (dvData.type === 'paragraph')
                continue; // very special type, don't try to do anything about it...
            
            var rules = Syntax[dvData.type];
            var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
            if (dType !== DeleteType_Empty)
                continue;
            // 
            // check left and right node. if type is the same, merge.
            var nLeft = xNodes[i].previousSibling;
            var nRight = xNodes[i].nextSibling;
            var dvLeft = nLeft ? Parser_GetDVAttrsFromNode(nLeft) : null;
            var dvRight = nRight ? Parser_GetDVAttrsFromNode(nRight) : null;
            var tNode = currentSource.substring(dvData.start, dvData.cstart);
            var tLeft = dvLeft ? currentSource.substring(dvLeft.start, dvLeft.cstart) : null;
            var tRight = dvRight ? currentSource.substring(dvRight.start, dvRight.cstart) : null;
            if (tNode === tLeft)
            {
                removeList.push([dvLeft.cend, dvLeft.end]);
                removeList.push([dvData.start, dvData.cstart]);
            }
            if (tNode === tRight)
            {
                removeList.push([dvData.cend, dvData.end]);
                removeList.push([dvRight.start, dvRight.cstart]);
            }
        }
        
        removeList.sort(function(a,b) { return a[0]-b[0]; });
        removeList = removeList.filter(function(t, index) {
            var c = 0;
            for (var i = 0; i < removeList.length; i++)
            {
                if (removeList[i][0] === t[0] && removeList[i][1] === t[1])
                    return i === index;
            }
            
            return false;
        });
        
        offset = 0;
        for (var i = 0; i < removeList.length; i++)
        {
            var len = removeList[i][1]-removeList[i][0];
            if (removeList[i][0] < cursor1)
                offset1 += len;
            if (removeList[i][0] < cursor2)
                offset2 += len;
            this.removeSource(removeList[i][0]-offset, removeList[i][1]-offset, false);
            offset += len;
        }
        
        //console.log('st2', cursor1, cursor2, offset1, offset2);
        cursor1-=offset1;
        cursor2-=offset2;
        
        this.setCursorToSource(cursor1, cursor2);
    },
    
    removeTagInSelection: function(tag, doUndoRedo)
    {
        if (!this.isMultiSelection())
            return;
        
        var selection = this.getSelection();
        
        // 1. get source location of start and end of selection.
        // 2. get all elements that fall under this range.
        // 3. process according to the rules.
        
        if (selection.anchorNode === this.Control && selection.focusNode === this.Control)
        {
            var cursor1 = 0;
            var cursor2 = this.SourceControl.value.length;
        }
        else
        {
            var s1 = this.getSourceLocation(selection.anchorNode, selection.anchorOffset);
            var s2 = this.getSourceLocation(selection.focusNode, selection.focusOffset);
            var cursor1 = s1.cursorPosition;
            var cursor2 = s2.cursorPosition;
            if (cursor2 < cursor1)
            {
                var t = cursor2;
                cursor2 = cursor1;
                cursor1 = t;
            }
        }
        
        var currentSource = this.SourceControl.value;
        if (doUndoRedo===void 0 || doUndoRedo) DVUndoRedo.addValue(currentSource, cursor2);
        
        return this.unwrapFormat(tag, cursor1, cursor2);
    },
    
    addTagInSelection: function(tag, doUndoRedo)
    {
        if (!this.isMultiSelection())
            return;
        
        var selection = this.getSelection();
        
        // 1. get source location of start and end of selection.
        // 2. get all elements that fall under this range.
        // 3. process according to the rules.
        
        if (selection.anchorNode === this.Control && selection.focusNode === this.Control)
        {
            var cursor1 = 0;
            var cursor2 = this.SourceControl.value.length;
        }
        else
        {
            var s1 = this.getSourceLocation(selection.anchorNode, selection.anchorOffset);
            var s2 = this.getSourceLocation(selection.focusNode, selection.focusOffset);
            var cursor1 = s1.cursorPosition;
            var cursor2 = s2.cursorPosition;
            if (cursor2 < cursor1)
            {
                var t = cursor2;
                cursor2 = cursor1;
                cursor1 = t;
            }
        }
        
        var currentSource = this.SourceControl.value;
        if (doUndoRedo===void 0 || doUndoRedo) DVUndoRedo.addValue(currentSource, cursor2);
        
        var c = this.removeTagInSelection(tag, false);
        cursor1 = c[0];
        cursor2 = c[1];
        
        this.wrapFormat(tag, cursor1, cursor2);
    },
    
    // removes source code from start to end (exclusive)
    removeSource: function(start, end, doUndoRedo)
    {
        // insert character.
        var loc = this.getSourceLocation();
        var dvSel = loc.dvSel;
        var dvData = loc.dvData;
        var cursorPosition = loc.cursorPosition;

        // insert character in the source code.
        this.setHandleSelection(false);
        var currentSource = this.SourceControl.value;
        if (doUndoRedo===void 0 || doUndoRedo) DVUndoRedo.addValue(currentSource, cursorPosition);
        
        currentSource = currentSource.substr(0, start)+currentSource.substr(end);
        this.SourceControl.value = currentSource;
        this.sourceInputChanged(true);
        this.setHandleSelection(true);
        
        if (cursorPosition >= start && cursorPosition < end)
            this.setCursorToSource(start);
        else if (cursorPosition >= end)
            this.setCursorToSource(cursorPosition-(end-start));
    },
    
    // inserts character/string at the current cursor position.
    insertSource: function(ch, doUndoRedo, doWrap)
    {
        // insert character.
        var loc = this.getSourceLocation();
        var dvSel = loc.dvSel;
        var dvData = loc.dvData;
        var cursorPosition = loc.cursorPosition;
        
        // insert character in the source code.
        this.setHandleSelection(false);
        var currentSource = this.SourceControl.value;
        if (doUndoRedo===void 0 || doUndoRedo) DVUndoRedo.addValue(currentSource, cursorPosition);
        
        if (this.isMultiSelection())
        {
            this.removeSelection(false);
            
            currentSource = this.SourceControl.value;
            loc = this.getSourceLocation();
            dvSel = loc.dvSel;
            dvData = loc.dvData;
            cursorPosition = loc.cursorPosition;
        }
        
        currentSource = currentSource.substr(0, cursorPosition)+ch+currentSource.substr(cursorPosition);
        this.SourceControl.value = currentSource;
        this.sourceInputChanged(true);
        this.setHandleSelection(true);
        
        cursorPosition+=ch.length;
        
        // and now, the magic!
        if (doWrap)
        {
            var cursor1 = cursorPosition-1;
            var cursor2 = cursorPosition;
            for (var i = 0; i < this.nextActions.length; i++)
            {
                var a = this.nextActions[i];
                var r = void 0;
                if (a.action < 0)
                {
                    r = this.unwrapFormat(a.mode, cursor1, cursor2);
                }
                else
                {
                    r = this.wrapFormat(a.mode, cursor1, cursor2);
                }
                cursor1 = r[0];
                cursor2 = r[1];
            }
            cursorPosition = cursor2;
        }
        
        this.nextClear();
        this.setCursorToSource(cursorPosition);
        return cursorPosition;
    },
    
    // static form send, to avoid using ajax all over.
    _staticFormSubmit: function(url, args)
    {
        if (args === void 0)
        {
            window.location.href = url;
            return;
        }
        
        var form_main = document.createElement('form');
        form_main.setAttribute('method', 'POST');
        form_main.setAttribute('action', url);
        var args_keys = Object.keys(args);
        args_keys.forEach(function(arg)
        {
            var argv = args[arg];
            // check if it's an array. translate to multiple field[]=value inputs.
            if (Object.prototype.toString.call(argv) === '[object Array]')
            {
                var argx = arg+'[]';
                argv.forEach(function(val)
                {
                    var form_field = document.createElement('input');
                    form_field.setAttribute('type', 'hidden');
                    form_field.setAttribute('name', argx);
                    form_field.setAttribute('value', val);
                    form_main.appendChild(form_field);
                });
            }
            else
            {
                var form_field = document.createElement('input');
                form_field.setAttribute('type', 'hidden');
                form_field.setAttribute('name', arg);
                form_field.setAttribute('value', argv);
                form_main.appendChild(form_field);
            }
        });
        
        // work around firefox bug (or normal behavior?)
        form_main.innerHTML += '<input type="submit" value="Click me" />';
        form_main.style.display = 'none';
        document.body.appendChild(form_main);
        form_main.submit();
    },
    
    // this function removes mode from specified range (by source location)
    unwrapFormat: function(tag, cursor1, cursor2)
    {
        var currentSource = this.SourceControl.value;
        var xNodes = this.getNodesBySource(cursor1, cursor2);
        var offset = 0;
        var offset1 = 0;
        var xNodesNew = [];
        
        for (var i = 0; i < xNodes.length; i++)
        {
            var xNode = xNodes[i].node;
            var xNodeBase = void 0;
            while (xNode && xNode !== this.Control && xNode != document.body)
            {
                var dvData = Parser_GetDVAttrsFromNode(xNode);
                
                dvData.node = xNode;
                dvData.tagStart = currentSource.substring(dvData.start, dvData.cstart);
                dvData.tagEnd = currentSource.substring(dvData.cend, dvData.end);
                
                if (dvData.type === 'base')
                    xNodeBase = xNode;
                else if (dvData.type === tag)
                {
                    if (xNodeBase && (xNode.firstChild !== xNodeBase || xNode.lastChild !== xNodeBase)) // only do this if we have multiple split base nodes
                    {
                        var dvDataReal = Parser_GetDVAttrsFromNode(xNodeBase);
                        dvData.rcstart = dvDataReal.cstart;
                        dvData.rcend = dvDataReal.cend;
                    }
                    else
                    {
                        dvData.rcstart = dvData.cstart;
                        dvData.rcend = dvData.cend;
                    }
                    
                    if (!xNodesNew.filter(function(xNodeNew) { return xNodeNew.node===xNode||xNodeNew.node===xNodeBase; }).length)
                        xNodesNew.push(dvData);
                    
                    break;
                }
                else xNodeBase = void 0;
                
                xNode = xNode.parentNode;
            }
        }
        
        // sort by child node count
        xNodesNew = xNodesNew.filter(function(xNode, index, self) {
            var dvP = DVEdit.getAllDVParents(xNode);
            for (var i = 1; i < dvP.length; i++)
            {
                for (var j = 0; j < xNodesNew.length; j++)
                {
                    if (xNodesNew[j].node === dvP[i]) // have parent in node list
                        return false;
                }
            }
            
            return true; // unique node
        });
        
        function splitNodes(xNode, index, parents, doLeft, doRight, coffset)
        {
            doLeft = !!doLeft;
            doRight = !!doRight;
            
            for (var c = xNode.firstChild; c; c = c.nextSibling)
            {
                var dvData = Parser_GetDVAttrsFromNode(c);
                // check if this node is even related. might be not.
                if (dvData.start > index || dvData.end <= index)
                    continue;
                
                if (c.firstChild.nodeType === Node.TEXT_NODE)
                {
                    // now, actually split. add ending and starting tags for each of the parents, EXCEPT first one (depending on doLeft/doRight)
                    //console.log(parents);
                    
                    var inserted = '';
                    for (var i = 0; i < parents.length; i++)
                    {
                        inserted = ((doLeft||i)?parents[i].tagEnd:'')+inserted+((doRight||i)?parents[i].tagStart:'');
                    }
                    
                    currentSource = currentSource.substring(0, index+offset)+inserted+currentSource.substring(index+offset);
                    offset += inserted.length;
                    if (doLeft) offset1 += inserted.length;
                    return;
                }
                else
                {
                    if (dvData.type !== void 0)
                    {
                        var xP = {};
                        xP.tagStart = currentSource.substring(dvData.start+coffset, dvData.cstart+coffset);
                        xP.tagEnd = currentSource.substring(dvData.cend+offset, dvData.end+offset);
                        parents.push(xP);
                    }
                    
                    splitNodes(c, index, parents, doLeft, doRight, coffset);
                }
            }
        }
        
        for (var i = 0; i < xNodesNew.length; i++)
        {
            var dvData = xNodesNew[i];
            var xNode = dvData.node;
            
            // check if remove on start
            var bStart = false; var bStartC = false;
            var bEnd = false; var bEndC = false;
            var xTagStart = dvData.tagStart;
            var xTagEnd = dvData.tagEnd;
            
            if (dvData.rcstart === dvData.cstart && dvData.rcend === dvData.cend)
            {
                var c = xNode;//.firstChild;
                while (c)
                {
                    var dvChild = Parser_GetDVAttrsFromNode(c);
                    if (dvChild.cstart >= cursor1)
                    {
                        bStart = true;
                        bStartC = (dvChild.cstart === cursor1);
                        break;
                    }
                    
                    c = c.firstChild;
                }
                
                c = xNode;//.lastChild;
                while (c)
                {
                    var dvChild = Parser_GetDVAttrsFromNode(c);
                    if (dvChild.cend <= cursor2)
                    {
                        bEnd = true;
                        bEndC = (dvChild.cend === cursor2);
                        break;
                    }
                    
                    c = c.lastChild;
                }
            }
            else
            {
                // this is a very special case...
                currentSource = currentSource.substring(0, dvData.rcstart+offset)+xTagEnd+currentSource.substring(dvData.rcstart+offset, dvData.rcend+offset)+xTagStart+currentSource.substring(dvData.rcend+offset);
                offset += xTagStart.length;
                offset1 += xTagStart.length;
                continue;
            }
            
            var coffset = offset;
            
            if (bStart)
            {
                currentSource = currentSource.substring(0, dvData.start+offset)+currentSource.substring(dvData.cstart+offset);
                offset -= xTagStart.length;
                //if (dvData.cstart === cursor1)
                if (bStartC)
                    offset1 -= xTagStart.length;
            }
            else
            {
                // start in the middle: split child nodes
                splitNodes(xNode, cursor1, [{tagStart: xTagStart, tagEnd: xTagEnd}], true, false, coffset);
            }
            
            if (bEnd)
            {
                currentSource = currentSource.substring(0, dvData.cend+offset)+currentSource.substring(dvData.end+offset);
                offset -= xTagEnd.length;
            }
            else
            {
                // end in the middle: split child nodes
                splitNodes(xNode, cursor2, [{tagStart: xTagStart, tagEnd: xTagEnd}], false, true, coffset);
            }
        }
        
        this.SourceControl.value = currentSource;
        this.sourceInputChanged(true);
        this.setHandleSelection(true);
        this.setCursorToSource(cursor1+offset1, cursor2+offset1);
        return [cursor1+offset1, cursor2+offset1]; // return this in case caller method wants to do anything about it
    },
    
    wrapFormat: function(tag, cursor1, cursor2)
    {
        var currentSource = this.SourceControl.value;
        
        var start = Syntax[tag].formatStart;
        var end = Syntax[tag].formatEnd;
        
        var offset = 0;
        var offset1 = 0;
        
        var xNodes = this.getNodesBySource(cursor1, cursor2);
        for (var i = 0; i < xNodes.length; i++)
        {
            var cstart = Math.max(xNodes[i].cstart, cursor1);
            var cend = Math.min(xNodes[i].cend, cursor2);
            currentSource = currentSource.substring(0, cstart+offset)+start+currentSource.substring(cstart, cend)+end+currentSource.substring(cend);
            offset += start.length+end.length;
        }
        
        this.SourceControl.value = currentSource;
        this.sourceInputChanged(true);
        this.setHandleSelection(true);
        this.setCursorToSource(cursor1+start.length, cursor2+offset-end.length);
        
        return [cursor1+start.length, cursor2+offset-end.length];
    },
    
    // schedule actions for next character that gets entered.
    nextActions: [],
    nextClear: function()
    {
        this.nextActions = [];
    },
    
    nextAdd: function(action, mode)
    {
        this.nextActions = this.nextActions.filter(function(a) { return a.mode !== mode; });
        this.nextActions.push({action: action, mode: mode});
    }

};

window.addEventListener('load', function()
{
    DVEdit.init();
});