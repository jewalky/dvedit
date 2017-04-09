<?php
    
    if (!defined('DOKU_INC'))
        define('DOKU_INC', realpath(dirname(__FILE__) . '/../../../') . '/');
    if (!defined('DOKU_PLUGIN'))
        define('DOKU_PLUGIN', DOKU_INC . 'lib/plugins/');
    require_once(DOKU_PLUGIN . 'action.php');
    
    class action_plugin_dvedit_edit extends DokuWiki_Action_Plugin
    {
        private $editor;
        
        function register(Doku_Event_Handler $controller)
        {
            // found in ckgedit
            $controller->register_hook('COMMON_PAGE_FROMTEMPLATE', 'AFTER', $this, 'pagefromtemplate', array());
            $controller->register_hook('COMMON_PAGETPL_LOAD', 'AFTER', $this, 'pagefromtemplate', array());
        
            $controller->register_hook('TPL_ACT_RENDER', 'BEFORE', $this, 'dvedit_render');
            $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'dvedit_meta');
            
            $editor = 'dw';
            if (isset($_GET['editor']))
            {
                $editor = ($_GET['editor']==='dv')?'dv':'dw';
                setcookie('dv-editor', $editor);
            }
            else if (isset($_COOKIE['dv-editor']))
            {
                $editor = ($_COOKIE['dv-editor']==='dv')?'dv':'dw';
            }
            else $editor = 'dw';
            
            if ($editor === 'dw')
                unset($_GET['editor']);
            
            $this->editor = $editor;
        }
        
        function pagefromtemplate(Doku_Event $event)
        {
            if ($event->data['tpl'])
            {
                $this->page_from_template = $event->data['tpl'];
            }
        }
        
        function dvedit_meta(Doku_Event $event)
        {
            global $ACT;
            // we only change the edit behaviour
            if ($ACT != 'edit') {
                return;
            }
            
            /*
            global $ID;
            global $REV;
            global $INFO;
            
            $event->data['script'][] = array(
                'type' => 'text/javascript',
                'charset' => 'utf-8',
                '_data' => '',
                'src' => DOKU_BASE . 'lib/plugins/ckgedit/' . $this->fck_location . '/ckeditor.js'
            );
            
            $ua = strtolower($_SERVER['HTTP_USER_AGENT']);
            if (strpos($ua, 'msie') !== false) {
                echo "\n" . '<meta http-equiv="X-UA-Compatible" content="IE=EmulateIE8" />' . "\n";
            }*/
            
            $scripts = array('parser', 'syntax', 'dvedit');
            
            foreach ($scripts as $script)
            {
                $event->data['script'][] = array(
                    'type' => 'text/javascript',
                    'charset' => 'utf-8',
                    'src' => DOKU_BASE . 'lib/plugins/dvedit/js/' . $script . '.js'
                );
            }
            
            return;
        }

        function dvedit_render(Doku_Event $event)
        {
            global $INFO;
            
            // we only change the edit behaviour
            if ($event->data != 'edit') {
                return;
            }
            
            $editor = $this->editor;
            
            // the switch
            $params_dw = $params_dv = $_GET;
            $params_dw['editor'] = 'dw';
            $params_dv['editor'] = 'dv';
            $params_dw = http_build_query($params_dw);
            $params_dv = http_build_query($params_dv);
            ?>
                <div class="dv-switcher">
                    <a href="?<?php echo $params_dw ?>" class="<?php echo ($editor==='dw')?'current':''; ?>">DokuWiki</a><a href="?<?php echo $params_dv ?>" class="<?php echo ($editor==='dv')?'current':''; ?>">DokuVisual</a>
                </div>
            <?php
            
            if ($editor === 'dv')
            {
                $event->preventDefault();
                $event->stopPropagation();
                $this->render();
            }
            else
            {
                // this means use default editor. do nothing here.
            }
        }
        
        function render()
        {
            // this is the code from dokuwiki.
            // all I change is the identifier of the source control and add my own control.
            global $INPUT;
            global $ID;
            global $REV;
            global $DATE;
            global $PRE;
            global $SUF;
            global $INFO;
            global $SUM;
            global $lang;
            global $conf;
            global $TEXT;

            if ($INPUT->has('changecheck')) {
                $check = $INPUT->str('changecheck');
            } elseif(!$INFO['exists']){
                // $TEXT has been loaded from page template
                $check = md5('');
            } else {
                $check = md5($TEXT);
            }
            $mod = md5($TEXT) !== $check;

            $wr = $INFO['writable'] && !$INFO['locked'];
            $include = 'edit';
            if($wr){
                if ($REV) $include = 'editrev';
            }else{
                // check pseudo action 'source'
                if(!actionOK('source')){
                    msg('Command disabled: source',-1);
                    return;
                }
                $include = 'read';
            }

            global $license;

            $form = new Doku_Form(array('id' => 'dw__editform'));
            $form->addHidden('id', $ID);
            $form->addHidden('rev', $REV);
            $form->addHidden('date', $DATE);
            $form->addHidden('prefix', $PRE . '.');
            $form->addHidden('suffix', $SUF);
            $form->addHidden('changecheck', $check);

            $data = array('form' => $form,
                          'wr'   => $wr,
                          'media_manager' => true,
                          'target' => ($INPUT->has('target') && $wr) ? $INPUT->str('target') : 'section',
                          'intro_locale' => $include);

            if (isset($data['intro_locale'])) {
                echo p_locale_xhtml($data['intro_locale']);
            }

            $form->addHidden('target', $data['target']);
            $form->addElement(form_makeOpenTag('div', array('id'=>'wiki__editbar', 'class'=>'editBar')));
            $form->addElement(form_makeOpenTag('div', array('id'=>'size__ctl')));
            $form->addElement(form_makeCloseTag('div'));
            
            $attr = array('tabindex'=>'1', 'class'=>'dv-sourcecode', 'name'=>'wikitext');
            if (!$wr) $attr['readonly'] = 'readonly';
            $form->addElement(form_makeOpenTag('textarea', $attr));
            $form->addElement($TEXT);
            $form->addElement(form_makeCloseTag('textarea'));
            $attr = array('class'=>'dv-visualframe');
            if ($wr) $attr['contenteditable'] = 'true';
            $form->addElement(form_makeOpenTag('div', $attr));
            $form->addElement(form_makeCloseTag('div'));
            
            if ($wr) {
                $form->addElement(form_makeOpenTag('div', array('class'=>'editButtons')));
                $form->addElement(form_makeButton('submit', 'save', $lang['btn_save'], array('id'=>'edbtn__save', 'accesskey'=>'s', 'tabindex'=>'4')));
                //$form->addElement(form_makeButton('submit', 'preview', $lang['btn_preview'], array('id'=>'edbtn__preview', 'accesskey'=>'p', 'tabindex'=>'5')));
                $form->addElement(form_makeButton('submit', 'draftdel', $lang['btn_cancel'], array('tabindex'=>'6')));
                $form->addElement(form_makeCloseTag('div'));
                $form->addElement(form_makeOpenTag('div', array('class'=>'summary')));
                $form->addElement(form_makeTextField('summary', $SUM, $lang['summary'], 'edit__summary', 'nowrap', array('size'=>'50', 'tabindex'=>'2')));
                $elem = html_minoredit();
                if ($elem) $form->addElement($elem);
                $form->addElement(form_makeCloseTag('div'));
            }
            
            $form->addElement(form_makeCloseTag('div'));
            if($wr && $conf['license']){
                $form->addElement(form_makeOpenTag('div', array('class'=>'license')));
                $out  = $lang['licenseok'];
                $out .= ' <a href="'.$license[$conf['license']]['url'].'" rel="license" class="urlextern"';
                if($conf['target']['extern']) $out .= ' target="'.$conf['target']['extern'].'"';
                $out .= '>'.$license[$conf['license']]['name'].'</a>';
                $form->addElement($out);
                $form->addElement(form_makeCloseTag('div'));
            }
            
            if ($wr) {
                // sets changed to true when previewed
                echo '<script type="text/javascript">/*<![CDATA[*/'. NL;
                echo 'textChanged = ' . ($mod ? 'true' : 'false');
                echo '/*!]]>*/</script>' . NL;
            }
            
            html_form('edit', $form);
            //print '</div>'.NL;
        }

    }
    
?>