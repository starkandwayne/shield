;(function ($, document, window, undefined) {

  $(function () {

    $(document.body)

      /* Hide the fly-out menu if we click _anywhere_ else */
      .on('click', function (event) { /* {{{ */
        $('.ephemeral').hide();
      }) /* }}} */

      /* Smudge fields */
      .on('click', 'form .smudge span', function (event) { /* {{{ */
        /*
           A smudge field displays initially as a password field, but features
           an in-control widget for toggling the visibility of the entered
           secret.  This allows users to verify that they typed in a key,
           without resorting to the double-confirmation method.

         */
        var $span = $(event.target).closest('span');
        var $fld  = $span.closest('.smudge').find('input');

        switch ($fld.attr('type')) {
        case "text":
          $fld.attr('type', 'password');
          $span.text('show');
          break;

        case "password":
          $fld.attr('type', 'text');
          $span.text('hide');
          break;
        }
      })/* }}} */

      /* Lean Table vs. Card View switcher */
      .on('click', '.switch-me .switcher a[href^="switch:"]', function (event) { /* {{{ */
        event.preventDefault();
        var view  = $(event.target).closest('a[href^="switch:"]').attr('href').replace(/^switch:/, '');
        var swtch = $(event.target).closest('.switch-me');

        $.each(swtch[0].className.split(/\s+/), function (i, cls) {
          if (cls.match(/-view$/)) {
            swtch.removeClass(cls);
          }
        });
        localStorage.setItem('view-preference', view);
        swtch.addClass(view);
      }) /* }}} */

      /* Account Fly-Out Menu */
      .on('click', '.top-bar a[rel=account]', function (event) { /* {{{ */
        event.preventDefault();
        event.stopPropagation();
        $('.top-bar .flyout').toggle();
      }) /* }}} */
      .on('click', '.top-bar .fly-out', function (event) { /* {{{ */
        /* don't propagate to the top-level click handler
           since that will hide the menu we just clicked on. */
        event.preventDefault();
        event.stopPropagation();
      }) /* }}} */
      .on('click', '.top-bar a[href^="switchto:"]', function (event) { /* {{{ */
        event.preventDefault();
        var uuid = $(event.target).attr('href').replace(/^switchto:/, '');
        api({
          type: 'PATCH',
          url:  '/v2/auth/user/settings',
          data: { default_tenant: uuid }
        });
        AEGIS.use(uuid);

        //SHIELD.redraw();
        var page = document.location.hash.replace(/^(#!\/[^\/]*).*/, '$1');
        if (page == "#!/do")      { page = "#!/systems"; }
        if (page == "#!/tenants") { page = "#!/systems"; }
        if (page == "#!/admin")   { page = "#!/systems"; }
        goto(page);
      }) /* }}} */

      /* Selectable Table UI Widget */
      .on('click', '.lean.selectable tbody tr', function (event) { /* {{{ */
        var $tr = $(event.target).closest('tr');
        var $tbl = $tr.closest('.lean.selectable');

        if ($tr.hasClass('selected')) {
          $tbl.removeClass('selected');
          $tr.removeClass('selected');
          $tbl.trigger('lean:deselected', [$tr]);
        } else {
          $tbl.find('tr.selected').removeClass('selected');
          $tbl.addClass('selected');
          $tr.addClass('selected');
          $tbl.trigger('lean:selected', [$tr]);
        }
      }) /* }}} */

      /* Sortable Table UI Widget */
      .on('click', 'table.sortable th.sortable', function (event) {
        var $thead = $(this).closest('thead');
        var $tbody = $(this).closest('table.sortable').find('tbody');

        var mode = ($(this).is('.sort.asc') ? -1 : 1);
        $(this).closest('thead').find('th').removeClass('sort asc desc');
        $(this).addClass('sort').addClass(mode == 1 ? 'asc' : 'desc');
        if ($(this).find('span').length == 0) {
          $(this).append('<span>');
        }

        var idx  = $(this).index();
        var type = $(this).attr('data-sort-as') || 'text';

        var rows = [];
        $tbody.find('tr').each(function (_, e) {
          var $tr = $(e).detach();
          var $td = $($tr.find('td')[idx]);
          var key = $td.is('[data-sort]') ? $td.attr('data-sort') : $td.text();

          switch (type) {
          case 'number': key = parseFloat(key); break;
          default:        break;
          }

          rows.push([key, $tr]);
        });

        rows.sort(function (a, b) {
          return mode * (a[0] > b[0] ?  1 :
                         a[0] < b[0] ? -1 : 0);
        });

        for (var i = 0; i < rows.length; i++) {
          $tbody.append(rows[i][1]);
        }
      })

      /* "Run Job" links (href="run:...") */
      .on('click', 'a[href^="run:"], button[rel^="run:"]', function (event) { /* {{{ */
        event.preventDefault();
        var uuid;
        if ($(event.target).is('button')) {
          uuid = $(event.target).attr('rel');
        } else {
          uuid  = $(event.target).closest('a[href^="run:"]').attr('href');
        }
        uuid = uuid.replace(/^run:/, '');

        banner('scheduling ad hoc backup...', 'progress');
        api({
          type: 'POST',
          url:  '/v2/tenants/'+AEGIS.current.uuid+'/jobs/'+uuid+'/run',
          success: function () {
            banner('ad hoc backup job scheduled');
          },
          error: function () {
            banner('unable to schedule ad hoc backup job', 'error');
          }
        });
      }) /* }}} */

      /* Task Pagination */
        .on('click', '.paginate .load-more', function (event) { /* {{{ */
          console.log('loading more tasks...'); /* FIXME: need "loading" div... */
          event.preventDefault();

          $(event.target).closest('.paginate').find('.loading').show();

          var url    = $(event.target).closest('[data-url]').attr('data-url');
          var oldest = $(event.target).closest('[data-oldest]').attr('data-oldest');
          api({
            type: 'GET',
            url:  url.replace('{oldest}', oldest),
            error: 'Failed to retrieve tasks from the SHIELD API.',
            success: function (system) {
              var $outer = $(event.target).closest('.paginate').find('.results');
              for (var i = 0; i < system.tasks.length; i++) {
                AEGIS.insert('task', system.tasks[i]);
                $outer.append($.template('timeline-entry', system.tasks[i]));
                if (oldest > system.tasks[i].requested_at) {
                    oldest = system.tasks[i].requested_at;
                }
              }
              $(event.target).closest('[data-oldest]').attr('data-oldest', oldest.toString());
              if (system.tasks.length == 0) {
                $(event.target).closest('.load-more').hide();
              }
              $(event.target).closest('.paginate').find('.loading').hide();
            }
          });
        }) /* }}} */

      /* Tasks View */
      .on('click', 'a[href^="task:"]', function (event) { /* {{{ */
        event.preventDefault();
        var uuid  = $(event.target).closest('a[href^="task:"]').attr('href').replace(/^task:/, '');
        var $ev   = $(event.target).closest('.event');
        var $task = $ev.find('.task');

        $task = $task.show()
                    .template('loading');

        api({
          type: 'GET',
          url:  '/v2/tenants/'+AEGIS.current.uuid+'/tasks/'+uuid,
          error: "Failed to retrieve task information from the SHIELD API.",
          success: function (data) {
            $task.template('task', {
              task: data,
              restorable: data.type == "backup" && data.archive_uuid != "" && data.status == "done",
            });
            $(event.target).closest('li').hide();
          }
        });
      }) /* }}} */
      .on('click', '.task button[rel="close"]', function (event) { /* {{{ */
        $ev = $(event.target).closest('.event');
        $ev.find('li.expand').show();
        $ev.find('.task').hide();
      }) /* }}} */
      .on('click', '.task button[rel^="annotate:"]', function (event) { /* {{{ */
        $(event.target).closest('.task').find('form.annotate').toggle();
      }) /* }}} */
      .on('submit', '.task form.annotate', function (event) { /* {{{ */
        event.preventDefault();

        var $form = $(event.target);
        var uuid = $form.extract('system-uuid');

        if ($form.is('[data-system-uuid] [data-task-uuid] *')) {
          var ann = {
            type  : "task",
            uuid  : $form.find('[name=uuid]').val(),
            notes : $form.find('[name=notes]').val()
          };
          if ($form.find('input[name=disposition]').length > 0) {
            ann.disposition = $form.find('input[name=disposition]').is(':checked')
                            ? "ok" : "failed";
          }
          ann.clear = $form.find('[optgroup=clear]:checked').val();
          if (ann.clear == '') {
            ann.clear = "normal";
          }

          api({
            type: 'PATCH',
            url:  '/v2/tenants/'+AEGIS.current.uuid+'/systems/'+uuid,
            data: { "annotations": [ann] },
            success: function (data) {
              $form.hide();
              banner("task annotation saved.");
              reload();
            },
            error: function (xhr) {
              $form.hide();
              banner("task annotation failed to save.", 'error');
            }
          });

        } else {
          throw 'unexpected annotation form (not a .tasks or .archives descendent)'
        }
      }) /* }}} */

      /* "Restore Archive" links (rel="restore:...") */
      .on('click', '.task button[rel^="restore:"]', function (event) { /* {{{ */
        var uuid   = $(event.target).extract('archive-uuid');
        var target = $(event.target).extract('system-name');
        var taken  = $(event.target).extract('archive-taken');
        console.log('restoring archive %s!', uuid);

        modal(template('restore-are-you-sure', {
            target: target,
            taken:  taken
          })).on('click', '[rel=yes]', function(event) {
          event.preventDefault();
          api({
            type: 'POST',
            url:  '/v2/tenants/'+AEGIS.current.uuid+'/archives/'+uuid+'/restore',
            success: function() {
              banner("restore operation started");
              redraw(false);
            },
            error: function () {
              banner("unable to schedule restore operation", "error");
            }
          });
        });
      }) /* }}} */

      /* SHIELD Unlock Form */
      .on('submit', 'form#unlock-shield', function (event) { /* {{{ */
        event.preventDefault();

        var $form = $(event.target);
        $form.reset()
        var data = $form.serializeObject();
        $form.find('[name=master]').val('');
        if (data.master == "") {
          $form.error('unlock-master', 'missing');
          return;
        }

        api({
          type: 'POST',
          url:  '/v2/unlock',
          data: data,
          success: function (data) {
            $('#lock-state .locked').fadeOut();
            goto(AEGIS.is('engineer') ? '#!/admin' : '#!/systems');
          },
          statusCode: {
            403: function () {
              $form.error('unlock-master', 'incorrect')
            },
            500: function (xhr) {
              $form.error(xhr.responseJSON);
            }
          },
          error: {}
        });
      }) /* }}} */

      /* Wizard: Configure New Backup Job */
      .on('wizard:step', '.do-configure.wizard2', function (event, moving) { /* {{{ */
        var $w = $(event.target);

        if (moving.to == 5) {
          var build_or_buy = function (prefix, type) {
            if ($w.find(prefix).extract('mode') == 'choose') {
              var uuid = $w.find(prefix+' tr.selected').extract(type+'-uuid');
              switch (type) {
              case 'target': return AEGIS.system(uuid);
              case 'store':  return AEGIS.store(uuid);
              default:       return { uuid: uuid };
              }
            }
            return $step.find('form').serializeObject()[type];
          };

          var data = {
            target: build_or_buy('[data-step=2]', 'target'),
            store:  build_or_buy('[data-step=3]', 'store'),
            job:    $w.find('[data-step=4] form').serializeObject().job
          };

          data.job.schedule = $w.find('[data-step=4] form').timespec();
          if (!data.job.keep_days) {
            data.job.keep_days = $w.find('[data-step=4] [name="job.keep_days"]').attr('placeholder');
          }
          data.job.keep_days = parseInt(data.job.keep_days);
          data.job.fixed_key = !data.job.randomize_keys;
          delete data.job.randomize_keys;

          $(event.target).data('submission', data);
          $w.find('.review').template('do-configure-review', data);
        }
      }) /* }}} */
      .on('click', '.do-configure.wizard2 button.final', function (event) { /* {{{ */
        event.preventDefault();
        $(event.target).addClass('submitting');

        var data = $(event.target).closest('.wizard2').data('submission');
        api({
          type: 'POST',
          url:  '/v2/tenants/'+AEGIS.current.uuid+'/systems',
          data: data,

          error: "Failed to create system via the SHIELD API.",
          complete: function () {
            $(event.target).removeClass('submitting');
          },
          success: function (data) {
            goto('#!/systems/system:uuid:'+data.uuid);
          }
        });
      }) /* }}} */
      .on('click', '.do-configure.wizard2 .scheduling .optgroup [data-subform]', function (event) { /* {{{ */
        var $w = $(event.target).closest('.wizard2');
        var sub = $(event.target).extract('subform');
        $w.find('.scheduling .subform').hide();
        $w.find('.scheduling .subform#'+sub).show();
        $w.find('input[name="job.keep_days"]')
            .attr('placeholder', $(event.target).extract('retain'));
      }) /* }}} */
      .on('lean:selected', '.do-configure.wizard2', function (event, $tr) { /* {{{ */
        $tr.closest('[data-step]').attr('data-mode', 'choose');
      }) /* }}} */
      .on('click', '.do-configure.wizard2 .choose [rel=new]', function (event) { /* {{{ */
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
        $(event.target).closest('[data-step]').attr('data-mode', 'create');
      }) /* }}} */

      /* Wizard: Run Ad Hoc Backup */
      .on('wizard:step', '.do-backup.wizard2', function (event, moving) { /* {{{ */
        var $w = $(event.target);

        if (moving.to == 3) { /* choose your backup archive */
          var data = {
            target:  { uuid: $w.find('[data-step=2] tr.selected').extract('target-uuid') },
          };
          $w.find('.redraw.jobs').template('do-backup-choose-job', data);
        }

        if (moving.to == 4) {
          var data = {
            target: { uuid: $w.find('[data-step=2] tr.selected').extract('target-uuid') },
            job:    { uuid: $w.find('[data-step=3] tr.selected').extract('job-uuid') }
          };

          $(event.target).data('submission', data);
          $w.find('.review').template('do-backup-review', data);
        }
      }) /* }}} */
      .on('click', '.do-backup.wizard2 button.final', function (event) { /* {{{ */
        event.preventDefault();
        $(event.target).addClass('submitting');

        var data = $(event.target).closest('.wizard2').data('submission');
        api({
          type: 'POST',
          url:  '/v2/tenants/'+AEGIS.current.uuid+'/jobs/'+data.job.uuid+'/run',
          data: {},

          error: "Failed to schedule a backup operation via the SHIELD API.",
          complete: function () {
            $(event.target).removeClass('submitting');
          },
          success: function () {
            goto('#!/systems/system:uuid:'+data.target.uuid);
          }
        });
      }) /* }}} */

      /* Wizard: Restore Data */
      .on('wizard:step', '.do-restore.wizard2', function (event, moving) { /* {{{ */
        var $w = $(event.target);

        if (moving.to == 3) { /* choose your backup archive */
          var data = {
            target:  { uuid: $w.find('[data-step=2] tr.selected').extract('target-uuid') },
          };
          $w.find('.redraw.archives').template('do-restore-choose-archive', data);
        }

        if (moving.to == 4) {
          var data = {
            target:  { uuid: $w.find('[data-step=2] tr.selected').extract('target-uuid') },
            archive: { uuid: $w.find('[data-step=3] tr.selected').extract('archive-uuid') }
          };

          $(event.target).data('submission', data);
          $w.find('.review').template('do-restore-review', data);
        }
      }) /* }}} */
      .on('click', '.do-restore.wizard2 button.final', function (event) { /* {{{ */
        event.preventDefault();
        $(event.target).addClass('submitting');

        var data = $(event.target).closest('.wizard2').data('submission');
        api({
          type: 'POST',
          url:  '/v2/tenants/'+AEGIS.current.uuid+'/archives/'+data.archive.uuid+'/restore',
          data: {},

          error: "Failed to schedule a restore operation via the SHIELD API.",
          complete: function () {
            $(event.target).removeClass('submitting');
          },
          success: function () {
            goto('#!/systems/system:uuid:'+data.target.uuid);
          }
        });
      }) /* }}} */

      /* Wizards (Shared) */
      .on('wizard:step', '.wizard2', function (event, moving) { /* {{{ */
        var $progress = $(event.target).find('.progress li');
        $(event.target).find('[data-step]').each(function (i,e) {
          var $step = $(e);
          var num   = parseInt($step.attr('data-step'));
          var $li   = $($progress[num-1]);

          if (num < moving.to) {
            $li.transitionClass('current', 'completed');
            $step.hide();

          } else if (num == moving.to) {
            $li.transitionClass('completed', 'current');
            $step.autofocus().show();

          } else {
            $li.removeClass('current completed');
            $step.hide();
          }
        });

        $(event.target).attr('data-on-step', moving.to);
      }) /* }}} */
      .on('click', '.wizard2 a[href^="step:"]', function (event) { /* {{{ */
        var from = parseInt($(event.target).extract('on-step'));
        var to   = parseInt($(event.target).closest('[href]').attr('href').replace(/^step:/, ''));
        event.preventDefault();
        $(event.target).closest('.wizard2')
                       .trigger('wizard:step', [{ from : from,
                                                  to   : to }]);
      }) /* }}} */
      .on('click', '.wizard2 [rel=prev]', function (event) { /* {{{ */
        event.preventDefault();
        var from = parseInt($(event.target).extract('on-step'));
        $(event.target).closest('.wizard2')
                       .trigger('wizard:step', [{ from : from,
                                                  to   : from - 1 }]);
      }) /* }}} */
      .on('click', '.wizard2 [rel=next]', function (event) { /* {{{ */
        event.preventDefault();
        var from = parseInt($(event.target).extract('on-step'));
        $(event.target).closest('.wizard2')
                       .trigger('wizard:step', [{ from : from,
                                                  to   : from + 1 }]);
      }) /* }}} */

    ;
  });

})(jQuery, document, window);
