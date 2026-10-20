# StudentSetu - Phase 2

Campus app for skill barter, paid peer tutoring and item hand-off.
OOP is in C++ (app/), data structures and algorithms are in C (matching/, services/).

## Run in VS Code (Windows, MSYS2 g++)

Open this folder with File > Open Folder, open a terminal, then:

    .\run.bat      build and start the app
    .\test.bat     build and run all tests

Choose 3 on the first screen to load demo data. Every demo account uses password 1234:
gunmay, ishwar, gaurav, asha, ravi (all @geu.ac.in).

## Who wrote what

| Part | Member | Files |
|---|---|---|
| Matching | Gunmay | matching/matching.h, text.c, graph.c, sort.c, Matcher.h, tests/test_matching.c, tests/test_matcher.cpp |
| App and OOP | Ishwar | app/Input.h, Student.h, Listing.h, Request.h, Store.h, App.h, main.cpp, tests/test_app.cpp |
| Search, waitlist, storage | Gaurav | services/services.h, hashtable.c, queue.c, SkillIndex.h, ItemSearch.h, Waitlist.h, Requests.h, FileManager.h, tests/test_services.c, tests/test_storage.cpp |

## Demo to try

- Login gunmay, Skills > Barter > python: exchange circle Gunmay -> Ishwar -> Gaurav.
- Login ravi, Skills > Barter > maths: direct swap with Asha.
- Items > Search > calclator (typo): finds the spare calculator, join its waitlist.
- Skills > Paid > Learn > maths: teachers sorted by price.
- Login asha, My Activity: accept a request and see the other person's email.

## Not in Phase 2

Email OTP, ratings, payments, chat and a graphical interface are planned for Phase 3.
Search accepts results that are 50% similar or more; on very short words this is loose.
