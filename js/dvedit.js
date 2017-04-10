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
        this.SourceControl = document.querySelector('.dv-sourcecode');
        this.Control = document.querySelector('.dv-visualframe');
        
        //
        this.SourceControl.addEventListener('input', function(e){return DVEdit.sourceInputChanged(false);});
        this.Control.addEventListener('keypress', function(e){return DVEdit.visualKeyPress(e);});
        this.Control.addEventListener('keydown', function(e){return DVEdit.visualKeyDown(e);});
        this.Control.addEventListener('keyup', function(e){return DVEdit.visualKeyUp(e);});
        document.addEventListener('selectionchange', function(e) { return DVEdit.selectionChanged(e);});
        
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
        var xSearch = document.evaluate('.//*', this.Control, null, XPathResult.ANY_TYPE, null);
        var xNode = void 0;
        var xNodes = [];
        while (xNode = xSearch.iterateNext())
            xNodes.push(xNode); // iterator will fail if the DOM changes. so first collect, then change.
        for (var i = 0; i < xNodes.length; i++)
        {
            xNode = xNodes[i];
            if (!xNode.getAttribute)
                continue;
            var dvData = Parser_GetDVAttrsFromNode(xNode);
            if ((dvData.cstart !== void 0 && dvData.cend !== void 0) && !xNode.lastChild)
            {
                // insert empty text. this is only visual!
                var textNode = document.createTextNode('\u200b');
                xNode.appendChild(textNode);
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
                else if (!xNode1)
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
                if (!xNode0)
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
    },
    
    visualKeyPress: function(e)
    {
        if (e.which < 0x20)
            return;
        
        var ch = String.fromCharCode(e.which);
        this.insertSource(ch);
        
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
    
    visualKeyDown: function(e)
    {
        var c = String.fromCharCode(e.keyCode);
        
        // enter key
        if (e.keyCode === 13)
        {
            if (e.shiftKey)
            {
                this.insertSource('\\\\ ');
            }
            else 
            {
                this.insertSource('\n\n');
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
                // delete before selection.
                var selection = this.getSelection();
                if (selection.anchorOffset > 0 && selection.anchorNode.textContent !== '\u200b')
                {
                    // delete one character before.
                    // find first element with dv-type.
                    var dvSel = this.getFirstDVParent(selection.focusNode);
                    var dvData = Parser_GetDVAttrsFromNode(dvSel);
                    
                    var rules = Syntax[dvData.type];
                    var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
                    
                    if (dType === DeleteType_Empty && selection.anchorNode.textContent.length === 1)
                    {
                        this.deleteAllEmptyInSelection();
                    }
                    else
                    {
                        var cursorPosition = selection.focusOffset+dvData.cstart;
                        
                        var currentSource = this.SourceControl.value;
                        currentSource = currentSource.substr(0, cursorPosition-1)+currentSource.substr(cursorPosition);
                        this.SourceControl.value = currentSource;
                        
                        this.sourceInputChanged(true);
                        this.setCursorToSource(cursorPosition-1);
                    }
                }
                else
                {
                    // we need to merge the current node with the previous one.
                    // this needs checking with the parser. might not be possible (e.g. if we're in a table)
                    // note: if we have a content-less element, we may safely delete it.
                    if (selection.anchorNode.parentNode.previousSibling)
                    {
                        var dvData = Parser_GetDVAttrsFromNode(selection.anchorNode.parentNode.previousSibling);
                        if (dvData.type !== void 0)
                        {
                            var rules = Syntax[dvData.type];
                            if (rules.deleteType === DeleteType_Overlapping)
                            {
                                //
                                this.removeSource(dvData.start, dvData.end);
                            }
                        }
                    }
                }
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
                // delete after selection.
                var selection = this.getSelection();
                if (selection.anchorOffset < selection.anchorNode.textContent.length && selection.anchorNode.textContent !== '\u200b')
                {
                    // delete one character after.
                    // find first element with dv-type.
                    var dvSel = this.getFirstDVParent(selection.focusNode);
                    var dvData = Parser_GetDVAttrsFromNode(dvSel);
                    
                    var rules = Syntax[dvData.type];
                    var dType = (rules.deleteType === void 0) ? DeleteType_Empty : rules.deleteType;
                    
                    if (dType === DeleteType_Empty && selection.anchorNode.textContent.length === 1)
                    {
                        this.deleteAllEmptyInSelection();
                    }
                    else
                    {
                        var cursorPosition = selection.focusOffset+dvData.cstart;
                        
                        var currentSource = this.SourceControl.value;
                        currentSource = currentSource.substr(0, cursorPosition)+currentSource.substr(cursorPosition+1);
                        this.SourceControl.value = currentSource;
                        
                        this.sourceInputChanged(true);
                        this.setCursorToSource(cursorPosition);
                    }
                }
                else
                {
                    // merge with next. same rules as above, needs finishing syntax.js.
                    // note: if we have a content-less element, we may safely delete it.
                    if (selection.anchorNode.parentNode.nextSibling)
                    {
                        var dvData = Parser_GetDVAttrsFromNode(selection.anchorNode.parentNode.nextSibling);
                        if (dvData.type !== void 0)
                        {
                            var rules = Syntax[dvData.type];
                            if (rules.deleteType === DeleteType_Overlapping)
                            {
                                //
                                this.removeSource(dvData.start, dvData.end);
                            }
                        }
                    }
                }
            }
        }
        else if (e.ctrlKey) // ctrl+something
        {
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
        while (base && base != this.Control)
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
        while (base && base != this.Control)
        {
            if (base.getAttribute && base.getAttribute('dv-type') !== void 0)
                list.push(base);
            base = base.parentNode;
        }
        
        return list;
    },
    
    // this retrieves DV node by source location
    getDVNodeBySource: function(index)
    {
        var xSearch = document.evaluate('.//*[@dv-type and @dv-cstart and @dv-cend and not(.//*[@dv-type])]', this.Control, null, XPathResult.ANY_TYPE, null);
        var xNode = void 0;
        var xMin = 0;
        var xMax = 2147483647;
        var xOutNode = void 0;

        while (xNode = xSearch.iterateNext())
        {
            var attrs = Parser_GetDVAttrsFromNode(xNode);
            if (attrs.cstart === void 0 || attrs.cend === void 0) // not editable element
                continue;
            if (attrs.cstart > index || attrs.cend < index)
                continue;
            
            if (attrs.cstart === index && attrs.cend === index)
                return xNode;
            
            if (attrs.cstart > xMin || attrs.cend < xMax)
            {
                xMin = attrs.cstart;
                xMax = attrs.cend;
                xOutNode = xNode;
            }
        }
        
        return xOutNode;
    },
    
    getSelection: function()
    {
        var selection = window.getSelection();
        return { focusNode: selection.focusNode, focusOffset: selection.focusOffset, 
                 anchorNode: selection.anchorNode, anchorOffset: selection.anchorOffset };
    },
    
    setSelection: function(sel, noset)
    {
        var range = document.createRange();
        range.setStart(sel.anchorNode, sel.anchorOffset);
        range.setEnd(sel.focusNode, sel.focusOffset);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    },
    
    setCursorToSource: function(index)
    {
        var selection = this.getSelection();
        var dvSel = this.getDVNodeBySource(index);
        if (!dvSel) return;
        
        var dvData = Parser_GetDVAttrsFromNode(dvSel);
        if (dvSel.firstChild)
        {
            selection.focusNode = selection.anchorNode = dvSel.firstChild;
            selection.focusOffset = selection.anchorOffset = index-dvData.cstart;
        }
        else
        {
            selection.focusNode = selection.anchorNode = dvSel;
            selection.focusOffset = selection.anchorOffset = 0;
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
    
    getNodesBySelection: function(all)
    {
        all = !!all;
        
        var selection = this.getSelection();
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
        
        return this.getNodesBySource(cursor1, cursor2, all);
    },
    
    getNodesBySource: function(cursor1, cursor2, all)
    {
        all = !!all;
        
        var xSearch = document.evaluate('.//*', this.Control, null, XPathResult.ANY_TYPE, null);
        var xNode;
        var xNodes = [];
        while (xNode = xSearch.iterateNext())
        {
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
                dvData.type = Parser_GetDVAttrsFromNode(dvParent[1]).type;
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
                    this.removeSource(dvData.start+offset1, dvData.end+offset1, false);
                    offset1 -= dvData.end-dvData.start;
                    cursor2 -= dvData.end-dvData.start;
                    break;
                case DeleteType_Empty:
                    if (!hasContent)
                        continue;
                    // remove content in the node, then delete the node itself if it's empty.
                    var start = Math.max(cursor1, dvData.cstart);
                    var end = Math.min(cursor2-offset1, dvData.cend);
                    var isEmpty = (start === dvData.cstart && end === dvData.cend);
                    start += offset1;
                    end += offset1;
                    if (isEmpty && dvData != startBlock)
                    {
                        this.removeSource(dvData.start+offset1, dvData.end+offset1, false);
                        offset1 -= dvData.end-dvData.start;
                        cursor2 -= dvData.end-dvData.start;
                    }
                    else
                    {
                        this.removeSource(start, end, false);
                        offset1 -= end-start;
                        cursor2 -= end-start;
                    }
                    break;
                case DeleteType_Never:
                    if (!hasContent)
                        continue;
                    // remove content in the node, don't delete the node even if empty.
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
        
        // if end node is the same as start node (type-wise), we can merge.
        if (xNodes[0].type === xNodes[xNodes.length-1].type &&
            xNodes[0].rules.deleteType !== DeleteType_Overlapping &&
            !stillhaveNodes)
        {
            var start = cursor1;
            var end = cursor2;
            this.removeSource(start, end, false);
            offset1 -= end-start;
            cursor2 -= end-start;
        }
        
        this.setCursorToSource(cursor1);
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
    insertSource: function(ch, doUndoRedo)
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
        
        this.setCursorToSource(cursorPosition);
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
    
    save: function()
    {
        
    }
    
};

window.addEventListener('load', function()
{
    DVEdit.init();
});