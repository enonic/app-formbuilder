# Enonic XP Form Builder #

This is an application to enable form-building in Enonic XP.
It has build-in support for Bootstrap, browser defaults and a custom made design.

The code and application are free-to-use under the MIT licence, which basically allows use in both open-source and enterprise applications, as long as a reference to this project is included.

I would appreciate a notice if you use my code, though, as I am interested in how others use it.

NB! Though this project is licenced under the MIT licence, Enonic XP itself is licenced under the GNU GPL licence.

## For developing on this application or forking it, see the bottom of the page ##

## How to install and use the form builder app ##

### Installing ###

1. From the applications tab: Download the application from Enonic Market.
2. From the content studio: Edit your site and add the application. Save.
![How site config should look after app has been installed](https://github.com/it-vegard/xp-form-builder/blob/master/docs/images/install-application.PNG "Site config with app installed")
3. From site config: Edit config. Choose styling for the app. You can choose between Twitter Bootstrap, browser defaults (your CSS will have full control over styling) and an example styling.
![App config before styling is chosen.](https://github.com/it-vegard/xp-form-builder/blob/master/docs/images/configure-app.PNG "Choose between Twitter bootstrap, browser default and an example styling.")
4. From the content studio: Create a page template. You can choose to base this on existing page templates, or choose the one supplied with this app.
5. Set what content types to associate the template with. You can of course associate it with the form content type, which will create standalone form pages, or you can add the form part on a landing page or similar.
6. From the template config: Add the form part. If you only associate the template with the form content type: Save and start making forms. If adding forms on other pages: You will have to edit the part configuration on the pages you want to show a form. In the part configuration you add the form you want to display. This also works if you make a fragment of the form, so the form is shown on any page you add the fragment.
![The form part configuration](https://github.com/it-vegard/xp-form-builder/blob/master/docs/images/form-part-config.PNG "Configure the part on the pages you add it unless they are standalone form pages.")
7. Create forms!

### My first form ###

All content types in the app are organized with 2-3 sections. 
* The basic settings should always be filled out. 
* Some may have a middle section related the specific content type. Although these are not required, it is recommended to fill them out. 
* The advanced settings are not normally required, and it will usually be the IT department that will make changes here.

1. From the content studio: Create a new form somewhere on a site where you added the application.
![How the content tree of the site could look after adding a form](https://github.com/it-vegard/xp-form-builder/blob/master/docs/images/form-added-to-site.PNG "Form added to site")
2. You have many options on how to configure your form, but in many cases you can just leave the default settings in place. 
 1. The only part you need to do, is add input elements. (We will get back to that in the next item) You can also add a heading (H2-level heading) above the form, though this is optional. 
 2. The next entries relate to how and where to submit the form. Although there are default settings, you most likely want to have a look at these.
  1. If submitting to Enonic, you can choose to add a folder to store the responses in. By default, the data is stored as child content under the form.
  2. You may want to add a response message. This will be displayed below the form after it is submitted.
  3. If you want to customize the text on the submit button, feel free.
 3. The next settings are all advanced features, and you should check with the IT department before changing these.
  1. If the form data should be submitted to a third-party application, you need to set the URL.
  2. Submit method: Defaults to POST, but choose GET where you want the form data added to the URL, like for search forms, etc.
  3. Ajax submit: Disable if the user should be sent to the URL specified above. Defaults to submitting and staying on the same page. The response message will be shown below the form to confirm that it has been submitted.
  4. Style: Override the styling chosen for the site.
3. Since you do not have any input elements right now, save and go back to the content studio.
4. You can now create input elements. Although they can be created anywhere on the site, the recommendation is to place them either as children to the form or in a central folder to re-use in different forms.
 1. There are a lot of different input types to choose from. They are not documented here, but all configuration options have help-texts (Available from Enonic XP 6.7).
 2. All legal HTML5 attributes are supported.
 3. The same rules as specified at the top of the section applies: You will almost always need to fill out the basic settings, some input types have a middle section that should be filled out, and the advanced settings should only be changed if you are sure of what the change will do.
5. After creating the input elements you need, edit the form and add them.
 1. You can sort the input elements as you want to.
6. That's it! Watch the responses pouring in

![Example of how you may set up the form responses, input elements and forms in the content studio. Example of a form to the right.](https://github.com/it-vegard/xp-form-builder/blob/master/docs/images/example-overview.PNG "Example of how the content studio may look with forms added.")

### Displaying responses ###

If you want an easy way to view the responses, a special page template is added for this purpose. These are the quick instructions on how to use this:

1. Create a new template in the content studio and select the page template called "Form response".
2. Set "Unstructured" as supported content types.
3. View your response by selecting it in the content studio. (No need to open the content!)
4. Now you can easily navigate between the responses by moving up and down in the site structure.

## Development instructions ##

### Prerequisites ###
* Install Enonic XP 6.3.0 or above
* Set the XP_HOME variable to point to your Enonic home folder.

### Installation ###
* Run "gradlew deploy" to install to a local installation.

### Install to server ###
* Run "gradlew build" to build, and then copy the jar-file created under "/build/libs" 
