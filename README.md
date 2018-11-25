# contentstage

Export (*extract*) page and category contents of a magento shop and re-import (*apply*) it to another. Effectively allows for a staging area to be used to develop content. 

## What *extract* does

* extract pages by identifier and store code (*admin* might just be *all* (id 0))
* (categories are to come)
* save to ```shop_content.json``` (in folder contents) and check in to git

## What *apply* does

* (it needs shop_content.json to be fully checked in)
* *extract* once more, and **stash** a potentially changed ```shop_content.json``` (so we have a backup)
* take ```shop_content.json``` and update pages with an update timestamp smaller (or equal) to ours
* (set the update timestamp to ours afterwards)
* (so far) show an error when update timestamp bigger (pot. conflict)
* create pages that don't exist yet

## Options / configuration

* ```--nogit``` does not check in or stash
* database connection see ```connection.js``` 
* to change the filename of the extracted contents, see ```serfile.js```

## potential extensions

* show diff on detected conflict
* contents of products, blocks, etc.
